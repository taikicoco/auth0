package main

import (
	"context"
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

type CustomClaims struct {
	Scope string `json:"scope"`
}

func (c CustomClaims) Validate(ctx context.Context) error {
	return nil
}

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Printf("Warning: Error loading .env file: %v", err)
	}

	issuerURL, err := url.Parse("https://" + os.Getenv("AUTH0_DOMAIN") + "/")
	if err != nil {
		log.Fatalf("Failed to parse the issuer url: %v", err)
	}

	provider := jwks.NewCachingProvider(issuerURL, 5*time.Minute)

	jwtValidator, err := validator.New(
		provider.KeyFunc,
		validator.RS256,
		issuerURL.String(),
		[]string{os.Getenv("AUTH0_AUDIENCE")},
		validator.WithCustomClaims(
			func() validator.CustomClaims {
				return &CustomClaims{}
			},
		),
		validator.WithAllowedClockSkew(time.Minute),
	)
	if err != nil {
		log.Fatalf("Failed to set up the jwt validator")
	}

	e := echo.New()

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	e.GET("/", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"message": "Auth0 Backend API",
		})
	})

	e.GET("/public", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"message": "This is a public endpoint accessible without authentication",
		})
	})

	protected := e.Group("/protected")
	protected.Use(jwtMiddleware(jwtValidator))

	protected.GET("/profile", func(c echo.Context) error {
		claims := c.Get("user").(*validator.ValidatedClaims)
		return c.JSON(http.StatusOK, map[string]interface{}{
			"message": "This is a protected endpoint",
			"user_id": claims.RegisteredClaims.Subject,
			"claims":  claims,
		})
	})

	protected.GET("/admin", func(c echo.Context) error {
		claims := c.Get("user").(*validator.ValidatedClaims)
		customClaims := claims.CustomClaims.(*CustomClaims)
		
		return c.JSON(http.StatusOK, map[string]interface{}{
			"message": "Admin endpoint accessed successfully",
			"user_id": claims.RegisteredClaims.Subject,
			"scope":   customClaims.Scope,
		})
	})

	log.Println("Server starting on :8080")
	e.Logger.Fatal(e.Start(":8080"))
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
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid token: "+err.Error())
			}

			c.Set("user", claims)
			return next(c)
		}
	}
}

func extractToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}

	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		return authHeader[7:]
	}

	return ""
}
