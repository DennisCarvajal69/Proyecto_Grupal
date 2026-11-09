(function () {
  'use strict';

  // ==============================================
  // UTILIDADES
  // ==============================================
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const SERVICIOS = {
    'Cambio de aceite': 120,
    'Frenos': 250,
    'Alineación y balanceo': 180,
    'Diagnóstico con scanner': 100,
    'Suspensión': 400,
    'Cambio de batería': 300,
    'Cambio de llantas': 150,
    'Mecánica general': 200
  };
  const ESTADOS = ['Recibido', 'En reparación', 'Listo', 'Entregado'];
  const CLASE_ESTADO = {
    'Recibido': 'e-recibido',
    'En reparación': 'e-reparacion',
    'Listo': 'e-listo',
    'Entregado': 'e-entregado'
  };

  function cargar(clave, def) {
    try {
      const v = JSON.parse(localStorage.getItem(clave));
      return v || def;
    } catch (e) { return def; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {}
  }
  function esc(texto) {
    const d = document.createElement('div');
    d.textContent = texto;
    return d.innerHTML;
  }
  // Timestamp legible: 08/11/2026 14:35:20
  function fmt(iso) {
    return new Date(iso).toLocaleString('es-BO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  }
  // Duración entre dos timestamps
  function duracion(desde, hasta) {
    const fin = hasta ? new Date(hasta) : new Date();
    let min = Math.max(0, Math.floor((fin - new Date(desde)) / 60000));
    const d = Math.floor(min / 1440); min %= 1440;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return (d ? d + ' d ' : '') + (h ? h + ' h ' : '') + m + ' min';
  }

  // ==============================================
  // DATOS
  // ==============================================
  let ordenes = cargar('ordenes', []);
  let bitacora = cargar('bitacora', []);

  // ==============================================
  // BITÁCORA DE EVENTOS (con timestamp)
  // ==============================================
  function registrarEvento(tipo, mensaje) {
    bitacora.unshift({ tipo: tipo, mensaje: mensaje, ts: new Date().toISOString() });
    if (bitacora.length > 300) bitacora.pop();
    guardar('bitacora', bitacora);
    renderBitacora();
  }

  function renderBitacora() {
    const filtro = $('#filtroTipo').value;
    const lista = bitacora.filter(e => filtro === 'todos' || e.tipo === filtro);
    $('#cantEventos').textContent = bitacora.length;

    $('#tbodyBitacora').innerHTML = lista.length
      ? lista.map(e =>
          '<tr><td>' + fmt(e.ts) + '</td>' +
          '<td><span class="tipo t-' + e.tipo + '">' + e.tipo + '</span></td>' +
          '<td>' + esc(e.mensaje) + '</td></tr>'
        ).join('')
      : '<tr><td colspan="3">No hay eventos para mostrar.</td></tr>';
  }

  $('#filtroTipo').addEventListener('change', function () {
    renderBitacora();
  });

  $('#btnLimpiar').addEventListener('click', function () {
    if (confirm('¿Seguro que deseas borrar toda la bitácora?')) {
      bitacora = [];
      guardar('bitacora', bitacora);
      registrarEvento('SISTEMA', 'Bitácora limpiada por el usuario');
      mostrarToast('Bitácora limpiada', 'ok');
    }
  });

  // ==============================================
  // TOAST
  // ==============================================
  let toastTimer;
  function mostrarToast(mensaje, tipo) {
    const t = $('#toast');
    t.textContent = mensaje;
    t.className = tipo + ' show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
  }

  // ==============================================
  // RELOJ EN VIVO
  // ==============================================
  function actualizarReloj() {
    $('#reloj').textContent = new Date().toLocaleTimeString('es-BO', { hour12: false });
  }
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
  // Refrescar "tiempo en taller" cada minuto
  setInterval(renderOrdenes, 60000);

  // ==============================================
  // PESTAÑAS Y MENÚ HAMBURGUESA
  // ==============================================
  function irATab(nombre) {
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + nombre));
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === nombre));
  }

  $$('[data-tab]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      irATab(el.dataset.tab);
      registrarEvento('NAVEGACION', 'Cambio a la pestaña: ' + el.dataset.tab);
      $('#menu').classList.remove('show');
    });
  });

  $('#hamburguesa').addEventListener('click', function () {
    $('#menu').classList.toggle('show');
    registrarEvento('NAVEGACION', 'Menú hamburguesa ' + ($('#menu').classList.contains('show') ? 'abierto' : 'cerrado'));
  });

  // ==============================================
  // TEMA CLARO / OSCURO
  // ==============================================
  if (cargar('tema', 'claro') === 'oscuro') {
    document.body.classList.add('dark');
    $('#btnTema').textContent = '☀️';
  }
  $('#btnTema').addEventListener('click', function () {
    document.body.classList.toggle('dark');
    const oscuro = document.body.classList.contains('dark');
    this.textContent = oscuro ? '☀️' : '🌙';
    guardar('tema', oscuro ? 'oscuro' : 'claro');
    registrarEvento('TEMA', 'Tema cambiado a ' + (oscuro ? 'oscuro' : 'claro'));
  });

  // ==============================================
  // FORMULARIO: SERVICIOS Y VALIDACIÓN
  // ==============================================
  Object.keys(SERVICIOS).forEach(function (s) {
    $('#servicio').insertAdjacentHTML('beforeend', '<option value="' + s + '">' + s + '</option>');
  });

  const reglas = {
    cliente: v => !v ? 'El nombre es obligatorio.'
      : !/^[A-Za-zÁÉÍÓÚáéíóúÑñ ]{3,}$/.test(v) ? 'Mínimo 3 letras, sin números.' : '',
    celular: v => !v ? 'El celular es obligatorio.'
      : !/^[67]\d{7}$/.test(v) ? 'Debe tener 8 dígitos y empezar con 6 o 7.' : '',
    placa: v => !v ? 'La placa es obligatoria.'
      : !/^\d{3,4}[A-Z]{3}$/.test(v) ? 'Formato válido: 1234ABC.' : '',
    vehiculo: v => !v ? 'Escribe la marca y modelo.'
      : v.length < 3 ? 'Mínimo 3 caracteres.' : '',
    servicio: v => !v ? 'Selecciona un servicio.' : '',
    descripcion: v => !v ? 'Describe el problema del vehículo.'
      : v.length < 10 ? 'Mínimo 10 caracteres.' : ''
  };

  function validarCampo(id, registrar) {
    const el = $('#' + id);
    const valor = el.value.trim();
    const msg = reglas[id](valor);
    el.classList.toggle('invalid', !!msg);
    el.classList.toggle('valid', !msg);
    el.closest('.campo').querySelector('.error').textContent = msg;
    if (msg && registrar) registrarEvento('ERROR', 'Campo "' + id + '" inválido: ' + msg);
    return !msg;
  }

  Object.keys(reglas).forEach(function (id) {
    const el = $('#' + id);
    el.addEventListener('input', () => validarCampo(id, false));
    el.addEventListener('blur', () => {
      if (el.value.trim() !== '') validarCampo(id, true);
    });
  });

  // Placa en mayúsculas y celular solo números
  $('#placa').addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
  $('#celular').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '');
  });
  // Contador de caracteres
  $('#descripcion').addEventListener('input', function () {
    $('#contador').textContent = this.value.length + '/200';
  });
  // Costo automático según servicio
  $('#servicio').addEventListener('change', function () {
    $('#costo').value = 'Bs ' + (SERVICIOS[this.value] || 0);
    registrarEvento('FORMULARIO', 'Servicio seleccionado: ' + (this.value || 'ninguno'));
  });

  $('#formOrden').addEventListener('submit', function (e) {
    e.preventDefault();

    // Se validan todos (sin cortocircuito) para mostrar todos los errores
    const resultados = Object.keys(reglas).map(id => validarCampo(id, false));
    if (resultados.includes(false)) {
      registrarEvento('ERROR', 'Intento de registro con datos inválidos');
      mostrarToast('⚠️ Revisa los campos marcados en rojo', 'error');
      return;
    }

    const ahora = new Date().toISOString();
    const servicio = $('#servicio').value;
    const orden = {
      id: Date.now(),
      cliente: $('#cliente').value.trim(),
      celular: $('#celular').value.trim(),
      placa: $('#placa').value.trim(),
      vehiculo: $('#vehiculo').value.trim(),
      servicio: servicio,
      costo: SERVICIOS[servicio],
      descripcion: $('#descripcion').value.trim(),
      estado: 'Recibido',
      historial: [{ estado: 'Recibido', ts: ahora }]
    };
    ordenes.unshift(orden);
    guardar('ordenes', ordenes);

    registrarEvento('ORDEN', 'Nueva orden registrada: ' + orden.placa + ' (' + orden.cliente + ')');
    mostrarToast('✅ Orden registrada para ' + orden.cliente, 'ok');

    this.reset();
    $$('#formOrden .valid, #formOrden .invalid').forEach(el => el.classList.remove('valid', 'invalid'));
    $$('#formOrden .error').forEach(el => el.textContent = '');
    $('#contador').textContent = '0/200';
    $('#costo').value = 'Bs 0';

    renderOrdenes();
    irATab('ordenes');
  });

  // ==============================================
  // ÓRDENES: RENDER, FILTROS Y ACCIONES
  // ==============================================
  function renderOrdenes() {
    const texto = $('#buscar').value.trim().toLowerCase();
    const filtro = $('#filtroEstado').value;

    const lista = ordenes.filter(o =>
      (filtro === 'todos' || o.estado === filtro) &&
      (!texto || (o.placa + ' ' + o.cliente + ' ' + o.vehiculo).toLowerCase().includes(texto))
    );

    $('#listaOrdenes').innerHTML = lista.map(function (o) {
      const ingreso = o.historial[0].ts;
      const ultimo = o.historial[o.historial.length - 1].ts;
      const entregado = o.estado === 'Entregado';
      const idx = ESTADOS.indexOf(o.estado);
      const siguiente = ESTADOS[idx + 1];

      return '<article class="orden ' + CLASE_ESTADO[o.estado] + '">' +
        '<div class="orden-top"><span class="placa">' + esc(o.placa) + '</span>' +
        '<span class="estado">' + o.estado + '</span></div>' +
        '<h3>🚗 ' + esc(o.vehiculo) + '</h3>' +
        '<p>👤 ' + esc(o.cliente) + ' · 📞 ' + esc(o.celular) + '</p>' +
        '<p>🔧 ' + esc(o.servicio) + ' · 💰 Bs ' + o.costo + '</p>' +
        '<p class="desc">' + esc(o.descripcion) + '</p>' +
        '<p class="ts">📥 Ingreso: ' + fmt(ingreso) + '</p>' +
        '<p class="ts">🔄 Último cambio: ' + fmt(ultimo) + '</p>' +
        '<p class="ts">⏱ ' + (entregado ? 'Duración total: ' : 'En el taller hace: ') +
          duracion(ingreso, entregado ? ultimo : null) + '</p>' +
        '<details><summary>Ver historial de estados</summary><ul>' +
          o.historial.map(h => '<li>' + h.estado + ' — ' + fmt(h.ts) + '</li>').join('') +
        '</ul></details>' +
        '<div class="acciones">' +
          (siguiente
            ? '<button data-accion="avanzar" data-id="' + o.id + '">Pasar a: ' + siguiente + '</button>'
            : '<button disabled>✔ Orden finalizada</button>') +
          '<button class="btn-del" data-accion="eliminar" data-id="' + o.id + '" title="Eliminar">🗑</button>' +
        '</div></article>';
    }).join('');

    $('#vacio').style.display = ordenes.length === 0 ? 'block' : 'none';

    // Estadísticas
    $('#stTotal').textContent = ordenes.length;
    $('#stRecibido').textContent = ordenes.filter(o => o.estado === 'Recibido').length;
    $('#stReparacion').textContent = ordenes.filter(o => o.estado === 'En reparación').length;
    $('#stListo').textContent = ordenes.filter(o => o.estado === 'Listo').length;
    $('#stEntregado').textContent = ordenes.filter(o => o.estado === 'Entregado').length;
  }

  // Delegación de eventos para los botones de cada tarjeta
  $('#listaOrdenes').addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-accion]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const orden = ordenes.find(o => o.id === id);
    if (!orden) return;

    if (btn.dataset.accion === 'avanzar') {
      const nuevo = ESTADOS[ESTADOS.indexOf(orden.estado) + 1];
      const anterior = orden.estado;
      orden.estado = nuevo;
      orden.historial.push({ estado: nuevo, ts: new Date().toISOString() });
      guardar('ordenes', ordenes);
      registrarEvento('ORDEN', orden.placa + ': ' + anterior + ' → ' + nuevo);
      mostrarToast('🔧 ' + orden.placa + ' ahora está: ' + nuevo, 'ok');
    }

    if (btn.dataset.accion === 'eliminar') {
      if (!confirm('¿Eliminar la orden de ' + orden.placa + '?')) return;
      ordenes = ordenes.filter(o => o.id !== id);
      guardar('ordenes', ordenes);
      registrarEvento('ORDEN', 'Orden eliminada: ' + orden.placa);
      mostrarToast('Orden eliminada', 'error');
    }
    renderOrdenes();
  });

  $('#buscar').addEventListener('input', renderOrdenes);
  $('#buscar').addEventListener('change', function () {
    registrarEvento('NAVEGACION', 'Búsqueda de órdenes: "' + this.value + '"');
  });
  $('#filtroEstado').addEventListener('change', function () {
    registrarEvento('NAVEGACION', 'Filtro de estado: ' + this.value);
    renderOrdenes();
  });

  // Datos de ejemplo para la demostración
  $('#btnEjemplos').addEventListener('click', function () {
    const hace = min => new Date(Date.now() - min * 60000).toISOString();
    ordenes = [
      { id: 1, cliente: 'Carlos Mamani', celular: '71234567', placa: '2345ABC', vehiculo: 'Toyota Corolla 2015',
        servicio: 'Frenos', costo: 250, descripcion: 'Los frenos hacen ruido al frenar fuerte.',
        estado: 'En reparación', historial: [{ estado: 'Recibido', ts: hace(180) }, { estado: 'En reparación', ts: hace(90) }] },
      { id: 2, cliente: 'María Quispe', celular: '69876543', placa: '1122XYZ', vehiculo: 'Suzuki Swift 2018',
        servicio: 'Cambio de aceite', costo: 120, descripcion: 'Cambio de aceite y filtro de rutina.',
        estado: 'Listo', historial: [{ estado: 'Recibido', ts: hace(120) }, { estado: 'En reparación', ts: hace(100) }, { estado: 'Listo', ts: hace(30) }] },
      { id: 3, cliente: 'Luis Condori', celular: '78889999', placa: '3456DEF', vehiculo: 'Nissan Frontier 2012',
        servicio: 'Suspensión', costo: 400, descripcion: 'Golpeteo en la parte delantera al pasar baches.',
        estado: 'Recibido', historial: [{ estado: 'Recibido', ts: hace(15) }] }
    ];
    guardar('ordenes', ordenes);
    registrarEvento('SISTEMA', 'Se cargaron 3 órdenes de ejemplo');
    renderOrdenes();
  });

  // ==============================================
  // REDES SOCIALES (registro de clics)
  // ==============================================
  $$('.social').forEach(function (a) {
    a.addEventListener('click', function () {
      registrarEvento('SOCIAL', 'Clic en red social: ' + a.textContent.trim());
    });
  });

  // ==============================================
  // INICIO
  // ==============================================
  renderOrdenes();
  renderBitacora();
  registrarEvento('SISTEMA', 'Sistema iniciado');

})();
