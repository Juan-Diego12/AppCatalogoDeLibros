package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"os"
	"time"
)

// Libro representa un elemento del catálogo (contrato acordado con el frontend).
type Libro struct {
	ID      int    `json:"id"`
	Titulo  string `json:"titulo"`
	Autor   string `json:"autor"`
	Anio    int    `json:"anio"`
	Portada string `json:"portada"`
}

// Rutas configurables por variables de entorno, con valores por defecto.
var (
	archivoDatos = envOrDefault("DATA_FILE", "data/libros.json")
	dirEstatico  = envOrDefault("STATIC_DIR", "static")
)

func envOrDefault(clave, porDefecto string) string {
	if v := os.Getenv(clave); v != "" {
		return v
	}
	return porDefecto
}

// responderJSON escribe cualquier valor como JSON con el código HTTP indicado.
func responderJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("error escribiendo respuesta: %v", err)
	}
}

func responderError(w http.ResponseWriter, status int, mensaje string) {
	responderJSON(w, status, map[string]string{"error": mensaje})
}

// cargarLibros lee el archivo JSON en CADA petición, así los cambios hechos
// con un editor de texto se reflejan sin reiniciar el servidor.
func cargarLibros() ([]Libro, error) {
	contenido, err := os.ReadFile(archivoDatos)
	if err != nil {
		return nil, err
	}
	// Quita el BOM que agregan algunos editores de Windows (p. ej. "UTF-8 con BOM"),
	// porque json.Unmarshal lo rechaza como JSON inválido.
	contenido = bytes.TrimPrefix(contenido, []byte("\xef\xbb\xbf"))
	var libros []Libro
	if err := json.Unmarshal(contenido, &libros); err != nil {
		return nil, err
	}
	return libros, nil
}

// GET /api/libros
func handlerLibros(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		responderError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	libros, err := cargarLibros()
	if err != nil {
		var errSintaxis *json.SyntaxError
		var errTipo *json.UnmarshalTypeError
		switch {
		case errors.Is(err, fs.ErrNotExist):
			log.Printf("no se encontró %s", archivoDatos)
			responderError(w, http.StatusInternalServerError, "no se encontró el archivo de datos")
		case errors.As(err, &errSintaxis), errors.As(err, &errTipo):
			log.Printf("JSON mal formado en %s: %v", archivoDatos, err)
			responderError(w, http.StatusInternalServerError, "el archivo de datos tiene un formato JSON inválido")
		default:
			log.Printf("error leyendo %s: %v", archivoDatos, err)
			responderError(w, http.StatusInternalServerError, "no se pudo leer el catálogo")
		}
		return
	}
	responderJSON(w, http.StatusOK, libros)
}

// GET /api/servidor -> nombre del host obtenido del sistema operativo.
func handlerServidor(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		responderError(w, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	nombre, err := os.Hostname()
	if err != nil {
		responderError(w, http.StatusInternalServerError, "no se pudo obtener el hostname")
		return
	}
	responderJSON(w, http.StatusOK, map[string]string{"hostname": nombre})
}

// registrar imprime cada petición en consola (útil para las capturas y,
// más adelante, para ver qué réplica atiende detrás del balanceador).
func registrar(siguiente http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		inicio := time.Now()
		siguiente.ServeHTTP(w, r)
		log.Printf("%s %s %s (%v)", r.RemoteAddr, r.Method, r.URL.Path, time.Since(inicio))
	})
}

func main() {
	puerto := envOrDefault("PORT", "8080")

	mux := http.NewServeMux()
	mux.HandleFunc("/api/libros", handlerLibros)
	mux.HandleFunc("/api/servidor", handlerServidor)
	mux.Handle("/", http.FileServer(http.Dir(dirEstatico)))

	nombre, _ := os.Hostname()
	log.Printf("Servidor en host %q escuchando en el puerto %s", nombre, puerto)
	log.Printf("Datos: %s | Estáticos: %s", archivoDatos, dirEstatico)

	if err := http.ListenAndServe(":"+puerto, registrar(mux)); err != nil {
		log.Fatal(err)
	}
}
