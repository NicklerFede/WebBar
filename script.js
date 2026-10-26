// Importar los SDKs de Firebase necesarios
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuración de tu proyecto "baron-pedidos"
const firebaseConfig = {
  apiKey: "AIzaSyCDOVv3Kx-EC25wPlG5RCJ9twCnsdkDeQk",
  authDomain: "baron-pedidos.firebaseapp.com",
  projectId: "baron-pedidos",
  storageBucket: "baron-pedidos.firebasestorage.app",
  messagingSenderId: "189094690590",
  appId: "1:189094690590:web:7d0716a690ae4cfe3bd30f",
  measurementId: "G-5KX8LVL1XW"
};

// Inicializar Firebase y Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variables globales de estado
let productoSeleccionado = "";
let metodoPagoSeleccionado = "Efectivo";
let modalidadEntrega = "delivery"; 
let isAdmin = false;

let pedidoCliente = {}; 
let extrasSeleccionados = {}; 

const productosPorDefecto = [
  {
    id: "prod_1",
    nombre: "Sándwich de Milanesa Completo",
    precio: 8500,
    activo: true,
    descripcion: "Milanesa de nalga tierna, lechuga, tomate, jamón, queso y mayonesa casera.",
    foto: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80",
    extras: [
      { nombre: "Sin Tomate", precio: 0 },
      { nombre: "Sin Jamón", precio: 0 },
      { nombre: "Sin Mayonesa", precio: 0 },
      { nombre: "Huevo Frito Extra", precio: 500 }
    ]
  },
  {
    id: "prod_2",
    nombre: "Cheeseburger Doble",
    precio: 7800,
    activo: true,
    descripcion: "Doble medallón smashed de 110g, cuádruple queso cheddar y salsa especial.",
    foto: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
    extras: [
      { nombre: "Panceta Extra", precio: 800 },
      { nombre: "Extra Cheddar", precio: 500 }
    ]
  }
];

window.estadoApp = {
  productos: [],
  ventas: []
};

// --- SISTEMA DE NOTIFICACIONES FLOTANTES (TOAST) A PRUEBA DE FALLOS ---
window.mostrarNotificacion = function(mensaje, titulo = "¡Éxito!", icono = "✨") {
  let toast = document.getElementById("toastNotificacion");
  
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastNotificacion";
    toast.className = "fixed top-20 right-6 z-[9999] transform translate-x-full opacity-0 transition-all duration-300 pointer-events-none flex items-center gap-3 bg-slate-900/95 border border-amber-500/50 text-slate-100 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md";
    toast.innerHTML = `
      <span id="toastIcono" class="text-xl">✨</span>
      <div>
        <h4 id="toastTitulo" class="font-black text-xs uppercase text-amber-400">Éxito</h4>
        <p id="toastMensaje" class="text-xs text-slate-300 font-medium">Operación realizada con éxito.</p>
      </div>
    `;
    document.body.appendChild(toast);
  }

  const tTitulo = toast.querySelector("#toastTitulo") || document.getElementById("toastTitulo");
  const tMensaje = toast.querySelector("#toastMensaje") || document.getElementById("toastMensaje");
  const tIcono = toast.querySelector("#toastIcono") || document.getElementById("toastIcono");

  if (tTitulo) tTitulo.textContent = titulo;
  if (tMensaje) tMensaje.textContent = mensaje;
  if (tIcono) tIcono.textContent = icono;

  toast.classList.remove("translate-x-full", "opacity-0", "pointer-events-none");
  toast.classList.add("translate-x-0", "opacity-100");

  if (window.toastTimeout) clearTimeout(window.toastTimeout);

  window.toastTimeout = setTimeout(() => {
    toast.classList.remove("translate-x-0", "opacity-100");
    toast.classList.add("translate-x-full", "opacity-0", "pointer-events-none");
  }, 3500);
};

// --- ESCUCHADORES EN TIEMPO REAL CON FIREBASE ---
function inicializarFirebaseListeners() {
  onSnapshot(collection(db, "productos"), (snapshot) => {
    let prods = [];
    snapshot.forEach((docSnap) => {
      prods.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (prods.length === 0) {
      productosPorDefecto.forEach(async (p) => {
        await setDoc(doc(db, "productos", p.id), p);
      });
      window.estadoApp.productos = productosPorDefecto;
    } else {
      window.estadoApp.productos = prods;
    }

    if (!productoSeleccionado && window.estadoApp.productos.length > 0) {
      productoSeleccionado = window.estadoApp.productos[0].nombre;
    }

    renderizarTodo();
  });

  onSnapshot(collection(db, "ventas"), (snapshot) => {
    let vts = [];
    snapshot.forEach((docSnap) => {
      vts.push({ id: docSnap.id, ...docSnap.data() });
    });

    vts.sort((a, b) => b.timestamp - a.timestamp);
    window.estadoApp.ventas = vts;

    renderizarTodo();
  });
}

// --- GESTIÓN DE INGREDIENTES DINÁMICOS EN ADMIN ---
window.agregarCampoIngrediente = function(nombre = '', precio = '') {
  const container = document.getElementById("contenedorCamposIngredientes");
  if (!container) return;
  
  const div = document.createElement("div");
  div.className = "flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800";
  div.innerHTML = `
    <input type="text" placeholder="Ej: Sin Tomate / Huevo" value="${nombre}" class="input-ing-nombre flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500">
    <input type="number" placeholder="Precio" value="${precio}" class="input-ing-precio w-24 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500">
    <button type="button" onclick="this.parentElement.remove()" class="text-rose-400 hover:text-rose-300 font-bold px-2 py-1 text-sm" title="Eliminar opción">✕</button>
  `;
  container.appendChild(div);
};

// --- NAVEGACIÓN Y EXPOSICIÓN GLOBAL PARA HTML ---
window.irAlMenuPublico = function() {
  window.location.hash = "public";
};

window.toggleDropdownAdmin = function() {
  const menu = document.getElementById("dropdownAdminMenu");
  if (menu) menu.classList.toggle("hidden");
};

window.cerrarDropdownAdmin = function() {
  const menu = document.getElementById("dropdownAdminMenu");
  if (menu) menu.classList.add("hidden");
};

window.addEventListener("click", function(e) {
  const container = document.getElementById("dropdownAdminContainer");
  if (container && !container.contains(e.target)) {
    window.cerrarDropdownAdmin();
  }
});

function verificarModoPorURL() {
  const hash = window.location.hash;
  if (hash === "#admin") {
    if (isAdmin) {
      activarModoAdminDirecto();
    } else {
      activarModoLogin();
    }
  } else {
    activarModoPublico();
  }
}

function activarModoLogin() {
  isAdmin = false;
  document.getElementById("vistaPrivadaAdmin").classList.add("hidden");
  document.getElementById("vistaPublicaStock").classList.add("hidden");
  document.getElementById("panelLoginCelda").classList.remove("hidden");
  document.getElementById("dropdownAdminContainer").classList.add("hidden");
  document.getElementById("btnAdminHeader").classList.add("hidden");
  document.getElementById("btnVerPublicoHeader").classList.remove("hidden");
  document.getElementById("btnWhatsappFlotante").classList.add("hidden");
  
  document.getElementById("tituloHeader").textContent = "Panel de Administración";
  document.getElementById("subtituloHeader").textContent = "Ingreso restringido para administradores";
  document.getElementById("inputUserAdmin").focus();
}

function activarModoAdminDirecto() {
  isAdmin = true;
  document.getElementById("panelLoginCelda").classList.add("hidden");
  document.getElementById("dropdownAdminContainer").classList.remove("hidden");
  document.getElementById("btnAdminHeader").classList.add("hidden");
  document.getElementById("btnVerPublicoHeader").classList.remove("hidden");
  document.getElementById("btnWhatsappFlotante").classList.add("hidden");
  
  document.getElementById("tituloHeader").textContent = "Panel de Administración";
  document.getElementById("subtituloHeader").textContent = "Control total de ventas, caja y stock";
  
  document.getElementById("vistaPrivadaAdmin").classList.remove("hidden");
  document.getElementById("vistaPublicaStock").classList.add("hidden");
  
  renderizarTodo();
}

function activarModoPublico() {
  isAdmin = false;
  document.getElementById("panelLoginCelda").classList.add("hidden");
  document.getElementById("dropdownAdminContainer").classList.add("hidden");
  document.getElementById("btnVerPublicoHeader").classList.add("hidden");
  document.getElementById("btnAdminHeader").classList.remove("hidden");
  document.getElementById("btnWhatsappFlotante").classList.remove("hidden");
  
  document.getElementById("tituloHeader").textContent = "BURGER & BAR";
  document.getElementById("subtituloHeader").textContent = "Menú digital para envíos a domicilio y retiro en local";
  
  document.getElementById("vistaPrivadaAdmin").classList.add("hidden");
  document.getElementById("vistaPublicaStock").classList.remove("hidden");
  
  renderizarStockPublico();
}

window.procesarLogin = function() {
  const u = document.getElementById("inputUserAdmin").value.trim();
  const p = document.getElementById("inputPassAdmin").value.trim();

  if (u === "admin" && p === "1234") {
    isAdmin = true;
    document.getElementById("inputUserAdmin").value = "";
    document.getElementById("inputPassAdmin").value = "";
    window.ocultarErrorLogin();
    window.location.hash = "admin";
    activarModoAdminDirecto();
    window.mostrarNotificacion("Bienvenido al panel de administración.", "Acceso Correcto", "🔓");
  } else {
    document.getElementById("msgErrorLogin").classList.remove("hidden");
  }
};

window.ocultarErrorLogin = function() {
  document.getElementById("msgErrorLogin").classList.add("hidden");
};

window.cerrarSesionAdmin = function() {
  isAdmin = false;
  window.location.hash = "public";
  window.mostrarNotificacion("Sesión cerrada correctamente.", "Salida Admin", "👋");
};

window.setModalidadEntrega = function(mod) {
  modalidadEntrega = mod;
  const btnDel = document.getElementById("btnModalidadDelivery");
  const btnTak = document.getElementById("btnModalidadTakeAway");
  const secDir = document.getElementById("secDireccionDelivery");

  if (mod === 'delivery') {
    btnDel.className = "p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition border-amber-500 bg-amber-950/60 text-amber-300 shadow-md";
    btnTak.className = "p-3 rounded-xl border border-slate-800 text-xs font-bold text-slate-400 flex items-center justify-center gap-2 transition hover:bg-slate-800";
    secDir.classList.remove("hidden");
  } else {
    btnTak.className = "p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition border-amber-500 bg-amber-950/60 text-amber-300 shadow-md";
    btnDel.className = "p-3 rounded-xl border border-slate-800 text-xs font-bold text-slate-400 flex items-center justify-center gap-2 transition hover:bg-slate-800";
    secDir.classList.add("hidden");
  }
  actualizarBotonWhatsApp();
};

function renderizarStockPublico() {
  const grid = document.getElementById("gridStockPublico");
  if (!grid) return;
  grid.innerHTML = "";

  const productos = window.estadoApp.productos || [];

  productos.forEach(p => {
    const cantActualCliente = pedidoCliente[p.nombre] || 0;
    const fotoSrc = p.foto || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80";

    let extrasHTML = "";
    if (p.extras && p.extras.length > 0 && p.activo) {
      extrasHTML += `<div class="pt-2 border-t border-slate-800/80 space-y-1"><p class="text-[11px] font-bold text-amber-400 uppercase">Ingredientes a Gusto / Opciones:</p>`;
      p.extras.forEach((ext) => {
        const key = `${p.nombre}_${ext.nombre}`;
        const checked = extrasSeleccionados[key] ? "checked" : "";
        const costoTexto = ext.precio > 0 ? `+$${ext.precio}` : 'Sin costo';
        extrasHTML += `
          <label class="flex items-center justify-between text-xs text-slate-300 cursor-pointer hover:text-white">
            <span>
              <input type="checkbox" onchange="window.toggleExtra('${p.nombre}', '${ext.nombre}', ${ext.precio})" ${checked} class="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-0 mr-2">
              ${ext.nombre}
            </span>
            <span class="font-bold text-slate-400">${costoTexto}</span>
          </label>
        `;
      });
      extrasHTML += `</div>`;
    }

    let controlesHTML = "";
    if (p.activo) {
      controlesHTML = `
        <div class="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800/80">
          <button onclick="window.modificarPedidoCliente('${p.nombre}', -1)" class="w-9 h-9 rounded-xl bg-slate-800 text-slate-200 font-bold hover:bg-slate-700 transition flex items-center justify-center">-</button>
          <span class="flex-1 text-center font-bold text-base text-slate-100">${cantActualCliente}</span>
          <button onclick="window.modificarPedidoCliente('${p.nombre}', 1)" class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 font-bold hover:bg-amber-500/30 transition flex items-center justify-center border border-amber-500/30">+</button>
        </div>
      `;
    } else {
      controlesHTML = `
        <div class="mt-3 pt-3 border-t border-slate-800/80 text-center">
          <span class="inline-block text-xs font-bold text-rose-400 bg-rose-950/60 border border-rose-900 px-3 py-1.5 rounded-xl">Agotado por hoy</span>
        </div>
      `;
    }

    grid.innerHTML += `
      <div class="bg-slate-900/90 rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col justify-between shadow-xl group backdrop-blur-md">
        <div class="aspect-[16/9] w-full overflow-hidden bg-slate-950 relative">
          <img src="${fotoSrc}" alt="${p.nombre}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500 ${!p.activo ? 'grayscale opacity-50' : ''}">
        </div>
        <div class="p-5 flex flex-col justify-between flex-1 space-y-3">
          <div>
            <div class="flex justify-between items-start gap-2">
              <h3 class="font-black text-slate-100 text-xl">${p.nombre}</h3>
              <span class="text-amber-400 font-black text-lg">$${p.precio.toLocaleString('es-AR')}</span>
            </div>
            <p class="text-xs text-slate-400 mt-1 leading-relaxed">${p.descripcion || 'Sin descripción.'}</p>
          </div>
          ${extrasHTML}
          ${controlesHTML}
        </div>
      </div>
    `;
  });

  actualizarBotonWhatsApp();
}

window.toggleExtra = function(nombreProd, nombreExtra, precioExtra) {
  const key = `${nombreProd}_${nombreExtra}`;
  if (extrasSeleccionados[key]) {
    delete extrasSeleccionados[key];
  } else {
    extrasSeleccionados[key] = { nombreProd, nombreExtra, precioExtra };
  }
  actualizarBotonWhatsApp();
};

window.modificarPedidoCliente = function(nombreProd, delta) {
  let actual = pedidoCliente[nombreProd] || 0;
  let nuevoValor = actual + delta;
  if (nuevoValor < 0) nuevoValor = 0;
  pedidoCliente[nombreProd] = nuevoValor;
  renderizarStockPublico();
};

function actualizarBotonWhatsApp() {
  const btn = document.getElementById("btnWhatsappFlotante");
  const label = document.getElementById("labelTextoWhatsapp");
  if (!btn || !label) return;

  const telefono = "5493814132279";
  let totalUnidades = 0;
  let totalPesos = 0;
  let lineasItems = [];

  for (let nombreProd in pedidoCliente) {
    let cant = pedidoCliente[nombreProd];
    if (cant > 0) {
      const prodObj = window.estadoApp.productos.find(p => p.nombre === nombreProd);
      let precioBase = prodObj ? prodObj.precio : 7800;
      
      let extrasTexto = [];
      for (let k in extrasSeleccionados) {
        if (extrasSeleccionados[k].nombreProd === nombreProd) {
          precioBase += extrasSeleccionados[k].precioExtra;
          extrasTexto.push(extrasSeleccionados[k].nombreExtra);
        }
      }

      totalUnidades += cant;
      totalPesos += cant * precioBase;
      
      let itemStr = `• ${cant}x ${nombreProd}`;
      if (extrasTexto.length > 0) itemStr += ` (${extrasTexto.join(', ')})`;
      lineasItems.push(itemStr);
    }
  }

  if (totalUnidades === 0) {
    label.textContent = "Realizar Pedido";
    btn.href = `https://wa.me/${telefono}?text=${encodeURIComponent("¡Hola! Quería consultar por el menú disponible.")}`;
  } else {
    label.textContent = `Enviar Pedido (${totalUnidades} un. - $${totalPesos.toLocaleString('es-AR')})`;
    
    let msg = `¡Hola! Quiero realizar un pedido en Burger & Bar:\n\n`;
    msg += lineasItems.join("\n");
    msg += `\n\n💰 *Total: $${totalPesos.toLocaleString('es-AR')}*`;
    msg += `\n📍 *Modalidad:* ${modalidadEntrega === 'delivery' ? '🛵 Delivery (Envío a Domicilio)' : '🛍️ Retiro por el Local'}`;
    
    if (modalidadEntrega === 'delivery') {
      const dir = document.getElementById("inputDireccionCliente") ? document.getElementById("inputDireccionCliente").value.trim() : "";
      msg += `\n🏠 *Dirección:* ${dir || '[Completar dirección]'}`;
    }

    btn.href = `https://wa.me/${telefono}?text=${encodeURIComponent(msg)}`;
  }
}

function renderizarGestionProductos() {
  const lista = document.getElementById("listaGestionProductos");
  if (!lista) return;
  lista.innerHTML = "";
  const productos = window.estadoApp.productos || [];

  productos.forEach(p => {
    const fotoSrc = p.foto || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80";
    lista.innerHTML += `
      <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${fotoSrc}" class="w-14 h-14 object-cover rounded-lg shrink-0 border border-slate-800">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h4 class="font-bold text-slate-100 text-sm truncate">${p.nombre}</h4>
              <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${p.activo ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}">${p.activo ? 'Activo' : 'Pausado'}</span>
            </div>
            <p class="text-xs text-amber-400 font-bold">$${p.precio.toLocaleString('es-AR')}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="window.toggleActivoProducto('${p.id}')" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-2.5 py-2 rounded-lg transition border border-slate-700">${p.activo ? '⏸️ Pausar' : '▶️ Activar'}</button>
          <button onclick="window.cargarEditarProducto('${p.id}')" class="bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold px-2.5 py-2 rounded-lg transition border border-slate-700">✏️</button>
          <button onclick="window.eliminarProducto('${p.id}')" class="bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-semibold px-2.5 py-2 rounded-lg transition border border-rose-800/60">🗑️</button>
        </div>
      </div>
    `;
  });
}

// --- OPERACIONES FIREBASE CON ACTUALIZACIÓN INTELIGENTE ---
window.toggleActivoProducto = async function(id) {
  try {
    const p = window.estadoApp.productos.find(x => String(x.id) === String(id));
    if (p) {
      await updateDoc(doc(db, "productos", String(id)), {
        activo: !p.activo
      });
      window.mostrarNotificacion("Estado del producto actualizado con éxito.", "Stock Modificado", "🔄");
    }
  } catch (error) {
    console.error(error);
    window.mostrarNotificacion("Error al actualizar: " + error.message, "Error de Permisos", "❌");
  }
};

window.guardarProducto = async function() {
  const idEdit = document.getElementById("editProdId").value;
  const nombre = document.getElementById("inputProdNombre").value.trim();
  const precio = parseFloat(document.getElementById("inputProdPrecio").value) || 0;
  const descripcion = document.getElementById("inputProdDesc").value.trim();
  const inputFoto = document.getElementById("inputProdFoto");

  if (!nombre || precio <= 0) { 
    window.mostrarNotificacion("Por favor completa el nombre y un precio válido.", "Atención", "⚠️");
    return; 
  }

  let extrasArr = [];
  const filasIng = document.querySelectorAll("#contenedorCamposIngredientes > div");
  filasIng.forEach(fila => {
    const nom = fila.querySelector(".input-ing-nombre").value.trim();
    const prec = parseFloat(fila.querySelector(".input-ing-precio").value) || 0;
    if (nom) {
      extrasArr.push({ nombre: nom, precio: prec });
    }
  });

  const continuarGuardado = async (fotoBase64) => {
    try {
      // Actualización inteligente: si no hay idEdit pero ya existe un producto con el mismo nombre, lo actualizamos automáticamente
      let docId = idEdit;
      if (!docId) {
        const prodExistente = (window.estadoApp.productos || []).find(
          p => p.nombre.toLowerCase() === nombre.toLowerCase()
        );
        if (prodExistente) {
          docId = prodExistente.id;
        } else {
          docId = 'prod_' + Date.now();
        }
      }

      const prodObj = {
        id: docId,
        nombre,
        precio,
        activo: true,
        descripcion,
        extras: extrasArr,
        foto: fotoBase64 || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80"
      };

      await setDoc(doc(db, "productos", docId), prodObj, { merge: true });
      window.resetearFormProducto();
      window.mostrarNotificacion("¡Producto guardado y actualizado con éxito!", "Menú Actualizado", "🍔");
    } catch (error) {
      console.error("Error detallado de Firebase:", error);
      window.mostrarNotificacion("Error al guardar: " + error.message, "Error en Firebase", "❌");
    }
  };

  if (inputFoto.files && inputFoto.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => continuarGuardado(e.target.result);
    reader.readAsDataURL(inputFoto.files[0]);
  } else {
    const pExist = window.estadoApp.productos.find(p => String(p.id) === String(idEdit));
    await continuarGuardado(pExist ? pExist.foto : null);
  }
};

window.cargarEditarProducto = function(id) {
  const prod = window.estadoApp.productos.find(p => String(p.id) === String(id));
  if (!prod) return;

  document.getElementById("editProdId").value = prod.id;
  document.getElementById("inputProdNombre").value = prod.nombre;
  document.getElementById("inputProdPrecio").value = prod.precio;
  document.getElementById("inputProdDesc").value = prod.descripcion || "";
  
  const containerIng = document.getElementById("contenedorCamposIngredientes");
  if (containerIng) containerIng.innerHTML = "";
  
  if (prod.extras && prod.extras.length > 0) {
    prod.extras.forEach(e => {
      window.agregarCampoIngrediente(e.nombre, e.precio);
    });
  }

  document.getElementById("tituloFormProducto").textContent = "✏️ Modificar Producto";
  document.getElementById("btnCancelarEdicionProd").classList.remove("hidden");
};

window.resetearFormProducto = function() {
  document.getElementById("editProdId").value = "";
  document.getElementById("inputProdNombre").value = "";
  document.getElementById("inputProdPrecio").value = "";
  document.getElementById("inputProdDesc").value = "";
  
  const containerIng = document.getElementById("contenedorCamposIngredientes");
  if (containerIng) containerIng.innerHTML = "";

  document.getElementById("inputProdFoto").value = "";
  document.getElementById("tituloFormProducto").textContent = "🍔 Agregar Producto";
  document.getElementById("btnCancelarEdicionProd").classList.add("hidden");
};

window.eliminarProducto = async function(id) {
  if (!confirm("¿Eliminar producto de Firebase?")) return;
  try {
    await deleteDoc(doc(db, "productos", String(id)));
    window.mostrarNotificacion("El producto fue eliminado con éxito.", "Eliminado", "🗑️");
  } catch (error) {
    window.mostrarNotificacion("Error al eliminar: " + error.message, "Error", "❌");
  }
};

window.guardarVenta = async function() {
  try {
    const cliente = document.getElementById("inputCliente").value.trim() || "Mostrador";
    const fecha = document.getElementById("inputFecha").value.trim() || obtenerFechaHoy();
    const estadoPago = document.getElementById("selectEstadoPago").value;
    const estadoEntrega = document.getElementById("selectEstadoEntrega").value;

    const prodObj = window.estadoApp.productos.find(p => p.nombre === productoSeleccionado);
    const precioUnitario = prodObj ? prodObj.precio : 7800;
    const cantidad = parseInt(document.getElementById("inputCantidad").value) || 1;

    const vId = 'v_' + Date.now();
    const ventaObj = {
      id: vId,
      cliente,
      producto: productoSeleccionado,
      cantidad,
      precioUnitario,
      metodoPago: metodoPagoSeleccionado,
      estadoPago,
      estadoEntrega,
      fecha,
      timestamp: Date.now()
    };

    await setDoc(doc(db, "ventas", vId), ventaObj);

    document.getElementById("inputCliente").value = "";
    window.setCantidad(1);
    window.mostrarNotificacion("¡Comanda creada con éxito!", "Pedido Registrado", "📋");
  } catch (error) {
    window.mostrarNotificacion("Error al crear comanda: " + error.message, "Error", "❌");
  }
};

window.toggleEstadoPago = async function(id) {
  try {
    const v = (window.estadoApp.ventas || []).find(x => String(x.id) === String(id));
    if (v) {
      const nuevoEstado = v.estadoPago === 'Pagado' ? 'Pendiente' : 'Pagado';
      await updateDoc(doc(db, "ventas", String(id)), { estadoPago: nuevoEstado });
      window.mostrarNotificacion(`Estado de pago cambiado a: ${nuevoEstado}`, "Caja Actualizada", "💵");
    }
  } catch (error) {
    window.mostrarNotificacion("Error: " + error.message, "Error", "❌");
  }
};

window.toggleEstadoEntrega = async function(id) {
  try {
    const v = (window.estadoApp.ventas || []).find(x => String(x.id) === String(id));
    if (v) {
      const nuevoEstado = v.estadoEntrega === 'Entregado' ? 'Pendiente' : 'Entregado';
      await updateDoc(doc(db, "ventas", String(id)), { estadoEntrega: nuevoEstado });
      window.mostrarNotificacion(`Estado de cocina cambiado a: ${nuevoEstado}`, "Cocina", "🍳");
    }
  } catch (error) {
    window.mostrarNotificacion("Error: " + error.message, "Error", "❌");
  }
};

window.eliminarVenta = async function(id) {
  if (confirm("¿Eliminar comanda de Firebase?")) {
    try {
      await deleteDoc(doc(db, "ventas", String(id)));
      window.mostrarNotificacion("Comanda eliminada con éxito.", "Registro Actualizado", "❌");
    } catch (error) {
      window.mostrarNotificacion("Error: " + error.message, "Error", "❌");
    }
  }
};

window.imprimirComanda = function(id) {
  const v = (window.estadoApp.ventas || []).find(x => String(x.id) === String(id));
  if (!v) return;

  const ticket = document.getElementById("ticketImpresion");
  ticket.innerHTML = `
    <div style="text-align:center; font-weight:bold; font-size:14px;">BURGER & BAR</div>
    <div style="text-align:center; margin-bottom:8px;">*** COMANDA DE COCINA ***</div>
    <hr style="border-top:1px dashed #000; margin:4px 0;">
    <div><b>Fecha:</b> ${v.fecha}</div>
    <div><b>Cliente:</b> ${v.cliente}</div>
    <div><b>Pago:</b> ${v.metodoPago} (${v.estadoPago})</div>
    <hr style="border-top:1px dashed #000; margin:4px 0;">
    <div style="font-size:13px; font-weight:bold;">
      ${v.cantidad}x ${v.producto}
    </div>
    <hr style="border-top:1px dashed #000; margin:4px 0;">
    <div style="text-align:right; font-weight:bold; font-size:14px;">
      TOTAL: $${(v.cantidad * v.precioUnitario).toLocaleString('es-AR')}
    </div>
  `;

  ticket.classList.remove("hidden");
  window.print();
  ticket.classList.add("hidden");
};

function obtenerFechaHoy() {
  const hoy = new Date();
  return `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
}

window.cambiarTabAdmin = function(tab) {
  document.getElementById("tabContentPendientes").classList.add("hidden");
  document.getElementById("tabContentCompletados").classList.add("hidden");
  document.getElementById("tabContentProductos").classList.add("hidden");

  document.getElementById("btnTabPendientes").className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition bg-slate-800 text-slate-300 hover:bg-slate-700";
  document.getElementById("btnTabCompletados").className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition bg-slate-800 text-slate-300 hover:bg-slate-700";
  document.getElementById("btnTabProductos").className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition bg-slate-800 text-slate-300 hover:bg-slate-700";

  if (tab === 'pendientes') {
    document.getElementById("btnTabPendientes").className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition bg-amber-500 text-slate-950 shadow-md";
    document.getElementById("tabContentPendientes").classList.remove("hidden");
  } else if (tab === 'completados') {
    document.getElementById("btnTabCompletados").className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition bg-emerald-500 text-slate-950 shadow-md";
    document.getElementById("tabContentCompletados").classList.remove("hidden");
  } else if (tab === 'productos') {
    document.getElementById("btnTabProductos").className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition bg-amber-500 text-slate-950 shadow-md";
    document.getElementById("tabContentProductos").classList.remove("hidden");
    renderizarGestionProductos();
  }
};

function renderizarVariedades() {
  const container = document.getElementById("gridVariedades");
  if (!container) return;
  container.innerHTML = "";
  const productos = window.estadoApp.productos || [];

  productos.forEach(p => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.onclick = () => { productoSeleccionado = p.nombre; renderizarVariedades(); calcularTotalesVenta(); };
    btn.className = `p-3 rounded-xl border text-left flex justify-between items-center transition ${p.nombre === productoSeleccionado ? 'border-amber-500 bg-amber-950/50 text-amber-300 ring-2 ring-amber-500/50' : 'border-slate-800 bg-slate-950 text-slate-200'}`;
    btn.innerHTML = `<span class="text-sm font-semibold truncate">${p.nombre}</span><span class="text-xs font-bold text-amber-400">$${p.precio.toLocaleString('es-AR')}</span>`;
    container.appendChild(btn);
  });
}

window.setCantidad = function(cant) {
  document.getElementById("inputCantidad").value = cant;
  calcularTotalesVenta();
};

window.modificarCantidad = function(delta) {
  const input = document.getElementById("inputCantidad");
  input.value = Math.max(1, (parseInt(input.value) || 1) + delta);
  calcularTotalesVenta();
};

window.setMetodoPago = function(metodo) {
  metodoPagoSeleccionado = metodo;
  document.getElementById("btnPagoEfectivo").className = metodo === 'Efectivo' ? "p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition border-amber-500 bg-amber-950/60 text-amber-300" : "p-2.5 rounded-lg border border-slate-800 text-xs font-medium text-slate-400 flex items-center justify-center gap-1.5 transition hover:bg-slate-800";
  document.getElementById("btnPagoTransf").className = metodo === 'Transferencia' ? "p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition border-blue-500 bg-blue-950/60 text-blue-300" : "p-2.5 rounded-lg border border-slate-800 text-xs font-medium text-slate-400 flex items-center justify-center gap-1.5 transition hover:bg-slate-800";
};

function calcularTotalesVenta() {
  const prodObj = window.estadoApp.productos.find(p => p.nombre === productoSeleccionado);
  const pv = prodObj ? prodObj.precio : 7800;
  const cant = parseInt(document.getElementById("inputCantidad").value) || 1;
  document.getElementById("labelTotalCobrar").textContent = `$${(cant * pv).toLocaleString('es-AR')}`;
}

function renderizarResumenFinanciero() {
  const ventas = window.estadoApp.ventas || [];
  let totalVendidos = 0, ingresosBrutos = 0, efectivoCaja = 0, transfIngresadas = 0, fiado = 0;

  ventas.forEach(v => {
    totalVendidos += v.cantidad;
    const sub = v.cantidad * v.precioUnitario;
    if (v.estadoPago === 'Pagado') {
      ingresosBrutos += sub;
      if (v.metodoPago === 'Efectivo') efectivoCaja += sub; else transfIngresadas += sub;
    } else {
      fiado += sub;
    }
  });

  document.getElementById("resumenVendidos").textContent = `${totalVendidos} un.`;
  document.getElementById("resumenBruta").textContent = `$${ingresosBrutos.toLocaleString('es-AR')}`;
  document.getElementById("resumenCajaReal").textContent = `$${efectivoCaja.toLocaleString('es-AR')}`;
  document.getElementById("resumenTransfNeta").textContent = `$${transfIngresadas.toLocaleString('es-AR')}`;
  document.getElementById("resumenFiado").textContent = `$${fiado.toLocaleString('es-AR')}`;
}

function renderizarHistorialVentasSeparado() {
  const tbodyPendientes = document.getElementById("tablaHistorialPendientes");
  const tbodyCompletados = document.getElementById("tablaHistorialCompletados");
  if (!tbodyPendientes || !tbodyCompletados) return;

  tbodyPendientes.innerHTML = "";
  tbodyCompletados.innerHTML = "";

  const ventas = window.estadoApp.ventas || [];
  let countPendientes = 0, countCompletados = 0;

  ventas.forEach(v => {
    const total = v.cantidad * v.precioUnitario;
    const entrega = v.estadoEntrega || 'Pendiente';
    const pago = v.estadoPago || 'Pagado';
    const esCompletado = (pago === 'Pagado' && entrega === 'Entregado');

    const filaHTML = `
      <tr class="hover:bg-slate-800/50">
        <td class="py-3 px-3 text-slate-400 whitespace-nowrap">${v.fecha || 'Sin fecha'}</td>
        <td class="py-3 px-3 font-semibold text-slate-200">${v.cliente}</td>
        <td class="py-3 px-3 text-slate-300">${v.producto}</td>
        <td class="py-3 px-3 text-center font-bold text-slate-200">${v.cantidad}</td>
        <td class="py-3 px-3 text-slate-300">${v.metodoPago}</td>
        <td class="py-3 px-3 text-right font-bold text-slate-200">$${total.toLocaleString('es-AR')}</td>
        <td class="py-3 px-3 text-center">
          <button onclick="window.toggleEstadoPago('${v.id}')" class="px-2.5 py-1 rounded-md text-xs font-bold ${pago === 'Pagado' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' : 'bg-rose-950 text-rose-400 border border-rose-800/50'}">${pago === 'Pagado' ? '✅ Pagado' : '⏳ Pendiente'}</button>
        </td>
        <td class="py-3 px-3 text-center">
          <button onclick="window.toggleEstadoEntrega('${v.id}')" class="px-2.5 py-1 rounded-md text-xs font-bold ${entrega === 'Entregado' ? 'bg-blue-950 text-blue-400 border border-blue-800/50' : 'bg-amber-950 text-amber-400 border border-amber-800/50'}">${entrega === 'Entregado' ? '📦 Despachado' : '⏳ En Prep.'}</button>
        </td>
        <td class="py-3 px-3 text-center flex items-center justify-center gap-1">
          <button onclick="window.imprimirComanda('${v.id}')" class="bg-slate-800 text-slate-300 font-bold px-2 py-1 rounded hover:bg-slate-700 text-xs" title="Imprimir Comanda">🖨️</button>
          <button onclick="window.eliminarVenta('${v.id}')" class="text-rose-400 font-bold px-2 py-1 hover:text-rose-300 text-base" title="Eliminar">✕</button>
        </td>
      </tr>`;

    if (esCompletado) {
      countCompletados++;
      tbodyCompletados.innerHTML += filaHTML;
    } else {
      countPendientes++;
      tbodyPendientes.innerHTML += filaHTML;
    }
  });

  document.getElementById("resumenTotalPendientesNum").textContent = `${countPendientes} activas`;
  document.getElementById("resumenTotalCompletadosNum").textContent = `${countCompletados} completados`;
}

function renderizarTodo() {
  renderizarStockPublico();
  if (isAdmin) {
    calcularTotalesVenta();
    renderizarVariedades();
    renderizarResumenFinanciero();
    renderizarHistorialVentasSeparado();
    renderizarGestionProductos();
  }
}

window.exportarJSON = function() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.estadoApp, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `backup_burger_bar.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

window.importarJSON = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.productos && Array.isArray(data.productos)) {
        for (let p of data.productos) {
          await setDoc(doc(db, "productos", String(p.id)), p, { merge: true });
        }
      }
      if (data.ventas && Array.isArray(data.ventas)) {
        for (let v of data.ventas) {
          await setDoc(doc(db, "ventas", String(v.id)), v, { merge: true });
        }
      }
      window.mostrarNotificacion("Respaldo JSON restaurado con éxito.", "Base Restaurada", "📤");
    } catch(err) {
      window.mostrarNotificacion("Error al procesar el archivo JSON.", "Error", "❌");
    }
  };
  reader.readAsText(file);
};

// --- INICIALIZACIÓN ---
function inicializar() {
  document.getElementById("inputFecha").value = obtenerFechaHoy();
  inicializarFirebaseListeners();
  verificarModoPorURL();
}

window.onload = inicializar;
window.onhashchange = verificarModoPorURL;