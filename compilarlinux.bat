@echo off
setlocal
set GOOS=linux
set GOARCH=amd64
set CGO_ENABLED=0
go build -o catalogo-libros .
if errorlevel 1 (
    echo Error al compilar
    exit /b 1
)
echo Compilado: catalogo-libros para Linux amd64
endlocal