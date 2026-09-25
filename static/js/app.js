// ===== Catálogo de libros: lógica del frontend =====
// Consulta la API del servidor Go y construye las tarjetas de los libros.

// Imagen de respaldo si una portada no existe o no carga
const PORTADA_RESPALDO = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450">' +
  '<rect width="100%" height="100%" fill="#dee2e6"/>' +
  '<text x="50%" y="50%" font-family="Arial" font-size="22" fill="#6c757d" ' +
  'text-anchor="middle">Sin portada</text></svg>'
);

const catalogo = document.getElementById("catalogo");
const estado = document.getElementById("estado");
const buscador = document.getElementById("buscador");
const orden = document.getElementById("orden");
const contador = document.getElementById("contador");

let libros = []; // copia en memoria del catálogo recibido de la API

// Quita tildes y pasa a minúsculas para que la búsqueda no dependa de ellas
function normalizar(texto) {
  return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Muestra un mensaje en la zona de estado (error o sin resultados)
function mostrarMensaje(texto, tipo) {
  const alerta = document.createElement("div");
  alerta.className = `alert alert-${tipo} d-inline-block`;
  alerta.textContent = texto;
  estado.replaceChildren(alerta);
  estado.classList.remove("d-none");
}

// ----- Nombre del servidor (GET /api/servidor) -----
async function cargarServidor() {
  let nombre = "desconocido";
  try {
    const respuesta = await fetch("/api/servidor", { cache: "no-store" });
    if (respuesta.ok) {
      nombre = (await respuesta.json()).hostname;
    }
  } catch (error) {
    console.error("No se pudo obtener el hostname:", error);
  }
  document.getElementById("host-encabezado").textContent = nombre;
  document.getElementById("host-pie").textContent = nombre;
}

// ----- Construcción de una tarjeta -----
// Se usa textContent (no innerHTML) para que el contenido del JSON
// nunca se interprete como código HTML.
function crearTarjeta(libro) {
  const columna = document.createElement("div");
  columna.className = "col";

  const tarjeta = document.createElement("article");
  tarjeta.className = "card h-100 shadow-sm libro";

  const imagen = document.createElement("img");
  imagen.className = "card-img-top portada";
  imagen.src = libro.portada;
  imagen.alt = `Portada de ${libro.titulo}`;
  imagen.loading = "lazy";
  imagen.onerror = () => {
    imagen.onerror = null;
    imagen.src = PORTADA_RESPALDO;
  };

  const cuerpo = document.createElement("div");
  cuerpo.className = "card-body d-flex flex-column";

  const titulo = document.createElement("h2");
  titulo.className = "card-title h6 mb-1";
  titulo.textContent = libro.titulo;
  titulo.title = libro.titulo; // muestra el título completo al pasar el mouse

  const autor = document.createElement("p");
  autor.className = "card-text small text-body-secondary mb-2";
  autor.textContent = libro.autor;

  const anio = document.createElement("span");
  anio.className = "badge text-bg-primary align-self-start mt-auto";
  anio.textContent = libro.anio;

  cuerpo.append(titulo, autor, anio);
  tarjeta.append(imagen, cuerpo);
  columna.append(tarjeta);
  return columna;
}

// ----- Filtrado, orden y dibujo de la grilla -----
function mostrarCatalogo() {
  const texto = normalizar(buscador.value.trim());

  const lista = libros.filter(libro =>
    normalizar(libro.titulo).includes(texto) || normalizar(libro.autor).includes(texto)
  );

  switch (orden.value) {
    case "titulo":
      lista.sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), "es"));
      break;
    case "anio-asc":
      lista.sort((a, b) => a.anio - b.anio);
      break;
    case "anio-desc":
      lista.sort((a, b) => b.anio - a.anio);
      break;
    default:
      lista.sort((a, b) => a.id - b.id);
  }

  catalogo.replaceChildren(...lista.map(crearTarjeta));
  contador.textContent = `Mostrando ${lista.length} de ${libros.length} libros`;

  if (lista.length === 0) {
    mostrarMensaje("Ningún libro coincide con la búsqueda.", "secondary");
  } else {
    estado.classList.add("d-none");
  }
}

// ----- Catálogo (GET /api/libros) -----
async function cargarLibros() {
  try {
    // no-store: siempre pide datos frescos, así un libro agregado
    // al JSON aparece con solo recargar la página
    const respuesta = await fetch("/api/libros", { cache: "no-store" });
    const datos = await respuesta.json();
    if (!respuesta.ok) {
      throw new Error(datos.error || `error ${respuesta.status}`);
    }
    libros = datos;
    mostrarCatalogo();
  } catch (error) {
    console.error(error);
    mostrarMensaje(`No se pudo cargar el catálogo: ${error.message}`, "danger");
  }
}

// ----- Eventos e inicio -----
buscador.addEventListener("input", mostrarCatalogo);
orden.addEventListener("change", mostrarCatalogo);

cargarServidor();
cargarLibros();