package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/auth0/go-jwt-middleware/v2/jwks"
	"github.com/auth0/go-jwt-middleware/v2/validator"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

const (
	defaultPort       = ":8080"
	jwksCacheDuration = 5 * time.Minute
	allowedClockSkew  = time.Minute
	bearerScheme      = "Bearer "
	userContextKey    = "user"
)

type CustomClaims struct {
	Scope string `json:"scope"`
}

func (c CustomClaims) Validate(ctx context.Context) error {
	return nil
}

type Config struct {
	Auth0Domain   string
	Auth0Audience string
	Port          string
}

func main() {
	config := loadConfig()

	jwtValidator, err := setupJWTValidator(config)
	if err != nil {
		log.Fatalf("Failed to setup JWT validator: %v", err)
	}

	e := setupServer(jwtValidator)

	log.Printf("Server starting on %s", config.Port)
	if err := e.Start(config.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func loadConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: Error loading .env file: %v", err)
	}

	config := &Config{
		Auth0Domain:   os.Getenv("AUTH0_DOMAIN"),
		Auth0Audience: os.Getenv("AUTH0_AUDIENCE"),
		Port:          defaultPort,
	}

	if port := os.Getenv("PORT"); port != "" {
		config.Port = ":" + port
	}

	if config.Auth0Domain == "" || config.Auth0Audience == "" {
		log.Fatal("AUTH0_DOMAIN and AUTH0_AUDIENCE environment variables are required")
	}

	return config
}

func setupJWTValidator(config *Config) (*validator.Validator, error) {
	issuerURL, err := url.Parse(fmt.Sprintf("https://%s/", config.Auth0Domain))
	if err != nil {
		return nil, fmt.Errorf("failed to parse issuer URL: %w", err)
	}

	provider := jwks.NewCachingProvider(issuerURL, jwksCacheDuration)

	jwtValidator, err := validator.New(
		provider.KeyFunc,
		validator.RS256,
		issuerURL.String(),
		[]string{config.Auth0Audience},
		validator.WithCustomClaims(
			func() validator.CustomClaims {
				return &CustomClaims{}
			},
		),
		validator.WithAllowedClockSkew(allowedClockSkew),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create JWT validator: %w", err)
	}

	return jwtValidator, nil
}

func setupServer(jwtValidator *validator.Validator) *echo.Echo {
	e := echo.New()

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	setupRoutes(e, jwtValidator)

	return e
}

func setupRoutes(e *echo.Echo, jwtValidator *validator.Validator) {
	e.GET("/", handleRoot)
	e.GET("/public", handlePublic)

	protected := e.Group("/protected")
	protected.Use(jwtMiddleware(jwtValidator))
	protected.GET("/profile", handleProfile)
}

func handleRoot(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{
		"message": "Auth0 Backend API",
	})
}

func handlePublic(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{
		"message": "This is a public endpoint accessible without authentication",
	})
}

func handleProfile(c echo.Context) error {
	claims, ok := c.Get(userContextKey).(*validator.ValidatedClaims)
	if !ok {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to get user claims")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"message": "This is a protected endpoint",
		"user_id": claims.RegisteredClaims.Subject,
		"claims":  claims,
	})
}

func jwtMiddleware(jwtValidator *validator.Validator) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			token := extractToken(c.Request())
			if token == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "missing or invalid token")
			}

			claims, err := jwtValidator.ValidateToken(context.Background(), token)
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, fmt.Sprintf("invalid token: %v", err))
			}

			c.Set(userContextKey, claims)
			return next(c)
		}
	}
}

func extractToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}

	if len(authHeader) > len(bearerScheme) && authHeader[:len(bearerScheme)] == bearerScheme {
		return authHeader[len(bearerScheme):]
	}

	return ""
}
