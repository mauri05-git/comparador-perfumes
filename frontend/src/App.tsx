import { useState, useEffect, useRef } from 'react';
import { Sparkles, Search, Camera, Scale, ShoppingBag, ShieldAlert, Terminal, Sun, Moon, Store, MapPin, TrendingUp, Star, Droplets, Wind, Heart, ExternalLink, Check, Compass, Printer, Clock, Activity, X, UserRound, RefreshCw } from 'lucide-react';
import { type DatosRadar } from './components/RadarOlfativoChart';
import { BannerSemaforoAlergia, ModalPerfilAlergias, CATALOGO_ALERGIAS_IFRA, type AlergenoDetectado } from './components/SistemaAlergias';
import { ModalListaCompras, type ItemListaCompra, type ListaPropia } from './components/ListaComprasDrawer';
import { ConsolaLogsModal, type EntradaLogSistema } from './components/ConsolaLogsModal';
import { QuizDescubridor } from './components/QuizDescubridor';
import { CatalogoFiltrosSidebar, CATALOGO_FRAGANCIAS_CHILE, aprenderPerfumeEnCatalogoLocal, etiquetasDePerfume, familiaCatalogoDesde, type FraganciaCatalogoItem } from './components/CatalogoFiltrosSidebar';
import { recomendarParaTi } from './paraTi';
import { esListaResumida, leerIngredientes } from './ingredientes';
import { migrarAlergiasGuardadas } from './alergenos';
import { esMismoPerfume, nombreSegunOferta, terminoDeBusqueda } from './nombres';
import { CampoPerfume } from './components/CampoPerfume';
import { ModalCuenta } from './components/ModalCuenta';
import { MenuGuardado } from './components/MenuGuardado';
import { t, tn, tServidor, idioma, fijarIdioma, localeFechas, IDIOMAS, type Idioma } from './i18n.ts';
import { fichaParaMostrar } from './fichaIdioma.ts';
import './App.css';
import { calcularPrecioPorMl, detectarGeneroProducto, extraerConcentracion, extraerMl, fichaConAlergenosDeOferta, haceCuanto, mismoProductoUrl, mlDeOferta, normalizarImagen, ofertaDeCatalogo, ofertaSoloUrl, otroPerfumeDeOferta, tituloConConcentracion } from './ofertas.ts';
import { API_BASE } from './api.ts';
import { type FichaFragancia, type PrecioMercado, type RegistroHistorial, type Review, type Sucursal } from './tipos.ts';
import { gruposDePerfumes } from './sugerencias.ts';
import { BottlePlaceholder, TarjetaPrecio } from './components/TarjetaPrecio.tsx';
import { ModalIngredientes } from './components/ModalIngredientes.tsx';
import { FichaFraganciaCard } from './components/FichaFragancia.tsx';
import { GuiaAplicacionCard } from './components/GuiaAplicacion.tsx';
import { SucursalesCard } from './components/Sucursales.tsx';
import { ReviewsSection } from './components/Resenas.tsx';
import { ComparadorLadoALado } from './components/Comparador.tsx';
import { ModalRangoBusqueda } from './components/ModalCobertura.tsx';

export default function App() {
  const [vistaPrincipal, setVistaPrincipal] = useState<'explorar' | 'comparar'>('explorar');
  const [subPestana, setSubPestana] = useState<'precios' | 'ficha' | 'guia' | 'similares' | 'reviews' | 'historial' | 'tiendas'>('precios');

  // ── Tema Claro / Oscuro siguiendo estándar color-scheme ──
  const [temaOscuro, setTemaOscuro] = useState<boolean>(() => {
    try {
      const guardado = localStorage.getItem('color-scheme');
      if (guardado === 'dark') return true;
      if (guardado === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  const alternarTema = () => {
    const nuevoOscuro = !temaOscuro;
    setTemaOscuro(nuevoOscuro);
    const targetScheme = nuevoOscuro ? 'dark' : 'light';
    const prefiereSistemaOscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const sistemaActual = prefiereSistemaOscuro ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', targetScheme);
    const meta = document.querySelector('meta[name="color-scheme"]');

    try {
      if (targetScheme === sistemaActual) {
        localStorage.removeItem('color-scheme');
        if (meta) meta.setAttribute('content', 'light dark');
      } else {
        localStorage.setItem('color-scheme', targetScheme);
        if (meta) meta.setAttribute('content', targetScheme);
      }
    } catch {}
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', temaOscuro ? 'dark' : 'light');
  }, [temaOscuro]);

  // ── Sistema de Alergias del Usuario (Semana 5) ──
  const [mostrarModalAlergias, setMostrarModalAlergias] = useState(false);
  const [alergiasUsuario, setAlergiasUsuario] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('perfumescan_alergias_ids');
      return s ? migrarAlergiasGuardadas(JSON.parse(s)) : [];
    } catch {
      return [];
    }
  });
  const [notasAlergiaCustom, setNotasAlergiaCustom] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('perfumescan_alergias_custom');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  const toggleAlergiaId = (id: string) => {
    const nuevas = alergiasUsuario.includes(id)
      ? alergiasUsuario.filter(a => a !== id)
      : [...alergiasUsuario, id];
    setAlergiasUsuario(nuevas);
    try { localStorage.setItem('perfumescan_alergias_ids', JSON.stringify(nuevas)); } catch {}
    registrarLogCliente('INFO', 'ALERGIAS', `Perfil dermatológico actualizado (${nuevas.length} compuestos IFRA activos)`);
  };

  const agregarNotaAlergiaCustom = (nota: string) => {
    if (notasAlergiaCustom.some(n => n.toLowerCase() === nota.toLowerCase())) return;
    const nuevas = [...notasAlergiaCustom, nota];
    setNotasAlergiaCustom(nuevas);
    try { localStorage.setItem('perfumescan_alergias_custom', JSON.stringify(nuevas)); } catch {}
    registrarLogCliente('INFO', 'ALERGIAS', `Ingrediente sensible personalizado añadido: "${nota}"`);
  };

  const eliminarNotaAlergiaCustom = (nota: string) => {
    const nuevas = notasAlergiaCustom.filter(n => n !== nota);
    setNotasAlergiaCustom(nuevas);
    try { localStorage.setItem('perfumescan_alergias_custom', JSON.stringify(nuevas)); } catch {}
  };

  // ── Lista de Compras / Favoritos sin Pasarela de Pago (Semana 5) ──
  const [mostrarModalLista, setMostrarModalLista] = useState(false);
  const [listaCompras, setListaCompras] = useState<ItemListaCompra[]>(() => {
    try {
      const s = localStorage.getItem('perfumescan_lista_compras');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  // Listas con nombre que crea el usuario ("Verano", "Para mamá"); un perfume puede estar en varias (item.listas)
  const [listasPropias, setListasPropias] = useState<ListaPropia[]>(() => {
    try {
      const s = localStorage.getItem('perfumescan_listas');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try { localStorage.setItem('perfumescan_listas', JSON.stringify(listasPropias)); } catch {}
  }, [listasPropias]);
  // Antes cada perfume iba en una sola categoría ("Por comprar", "Favorito" o "Para regalar"). Ahora todo lo guardado
  // es un favorito y se ordena en listas propias: lo que estaba "Para regalar" pasa a una lista con ese nombre, para no
  // perder esa separación. Corre también con las listas que llegan de la cuenta.
  useEffect(() => {
    if (!listaCompras.some(i => i.categoria)) return;
    const regalos = listaCompras.filter(i => i.categoria === 'regalo');
    let listas = listasPropias;
    let idRegalos: string | null = null;
    if (regalos.length) {
      const existente = listas.find(l => l.nombre.toLowerCase() === 'para regalar');
      idRegalos = existente?.id || `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      if (!existente) listas = [...listas, { id: idRegalos, nombre: 'Para regalar' }];
    }
    const migrada = listaCompras.map(({ categoria, ...resto }) =>
      categoria === 'regalo' && idRegalos && !resto.listas?.includes(idRegalos)
        ? { ...resto, listas: [...(resto.listas || []), idRegalos] }
        : resto,
    );
    setListasPropias(listas);
    setListaCompras(migrada);
    try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(migrada)); } catch {}
  }, [listaCompras, listasPropias]);
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);

  const dispararToast = (msg: string) => {
    setToastMensaje(msg);
    setTimeout(() => setToastMensaje(null), 2800);
  };

  // El mismo producto: misma URL de tienda (o, sin URL, mismo nombre) y mismo tamaño. Así se pueden guardar dos
  // tamaños o dos tiendas del mismo perfume, pero no el mismo producto dos veces. El tamaño se compara aparte porque
  // en Falabella el 50 ml y el 100 ml son variantes de un mismo producto; si un lado no lo sabe, se toma como el mismo.
  type Guardable = { perfume: string; url: string; ml?: number | null };
  const mismoGuardado = (a: Guardable, b: Guardable) =>
    (a.url && b.url ? mismoProductoUrl(a.url, b.url) : a.perfume.toLowerCase() === b.perfume.toLowerCase()) &&
    (!a.ml || !b.ml || a.ml === b.ml);
  const estaEnLista = (x: Guardable) => listaCompras.some(i => mismoGuardado(i, x));

  // ── Cuenta (opcional): Mi Lista y las alergias se guardan en el servidor ──
  const [usuarioCuenta, setUsuarioCuenta] = useState<{ email: string } | null>(null);
  const [mostrarModalCuenta, setMostrarModalCuenta] = useState(false);
  // Hasta que no se juntan los datos de la cuenta con los del navegador no se guarda nada (pisaría la cuenta)
  const sincronizadoRef = useRef(false);
  const conCookie = (ruta: string, init: RequestInit = {}) =>
    fetch(`${API_BASE}${ruta}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } });

  const guardarLocal = (lista: ItemListaCompra[], alergias: string[], notas: string[], listas: ListaPropia[]) => {
    setListaCompras(lista);
    setListasPropias(listas);
    setAlergiasUsuario(alergias);
    setNotasAlergiaCustom(notas);
    try {
      localStorage.setItem('perfumescan_lista_compras', JSON.stringify(lista));
      localStorage.setItem('perfumescan_alergias_ids', JSON.stringify(alergias));
      localStorage.setItem('perfumescan_alergias_custom', JSON.stringify(notas));
    } catch {}
  };

  // Al entrar: lo de la cuenta más lo que había en el navegador (sin repetir), y se guarda la suma en la cuenta
  const sincronizarCuenta = async () => {
    sincronizadoRef.current = false;
    try {
      const r = await conCookie('/api/cuenta/datos');
      if (r.status === 401) return setUsuarioCuenta(null);
      const remotos = await r.json();
      const lista = [...(remotos.lista || [])];
      for (const local of listaCompras) if (!lista.some(i => mismoGuardado(i, local))) lista.push(local);
      const alergias = [...new Set([...(remotos.alergias || []), ...alergiasUsuario])];
      const notas = [...new Set([...(remotos.notas || []), ...notasAlergiaCustom])];
      const listas: ListaPropia[] = [...(remotos.listas || [])];
      for (const l of listasPropias) if (!listas.some(r => r.id === l.id)) listas.push(l);
      guardarLocal(lista, alergias, notas, listas);
      sincronizadoRef.current = true;
      await conCookie('/api/cuenta/datos', { method: 'PUT', body: JSON.stringify({ lista, alergias, notas, listas }) });
    } catch {
      // backend apagado: se reintenta la próxima vez que cargue la app
    }
  };

  useEffect(() => {
    conCookie('/api/cuenta')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.usuario) setUsuarioCuenta(d.usuario);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (usuarioCuenta) sincronizarCuenta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioCuenta?.email]);

  // Cada cambio se guarda en la cuenta, agrupado para no enviar uno por tecla
  useEffect(() => {
    if (!usuarioCuenta || !sincronizadoRef.current) return;
    const temporizador = setTimeout(() => {
      conCookie('/api/cuenta/datos', {
        method: 'PUT',
        body: JSON.stringify({ lista: listaCompras, alergias: alergiasUsuario, notas: notasAlergiaCustom, listas: listasPropias }),
      })
        .then(r => {
          // Sesión vencida: se deja de sincronizar, sin borrar lo que hay en el navegador
          if (r.status === 401) setUsuarioCuenta(null);
        })
        .catch(() => {});
    }, 1200);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaCompras, alergiasUsuario, notasAlergiaCustom, listasPropias, usuarioCuenta]);

  const enviarCuenta = async (modo: 'entrar' | 'registro', email: string, contrasena: string): Promise<string | null> => {
    try {
      const r = await conCookie(`/api/cuenta/${modo}`, { method: 'POST', body: JSON.stringify({ email, contrasena }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return tServidor(d.error) || t('No se pudo completar. Intenta de nuevo.');
      setUsuarioCuenta(d.usuario);
      dispararToast(modo === 'registro' ? t('Cuenta creada: tu lista se guarda en ella') : t('Hola, {correo}', { correo: d.usuario.email }));
      return null;
    } catch {
      return 'No se pudo conectar con el servidor.';
    }
  };

  // Al salir se borran del navegador la lista y las alergias, por si el equipo es compartido
  const salirDeCuenta = async () => {
    try { await conCookie('/api/cuenta/salir', { method: 'POST' }); } catch {}
    sincronizadoRef.current = false;
    setUsuarioCuenta(null);
    guardarLocal([], [], [], []);
    setMostrarModalCuenta(false);
    dispararToast(t('Sesión cerrada'));
  };

  const cambiarContrasenaCuenta = async (actual: string, nueva: string): Promise<string | null> => {
    try {
      const r = await conCookie('/api/cuenta/contrasena', { method: 'POST', body: JSON.stringify({ contrasena: actual, nueva }) });
      if (r.ok) return null;
      return tServidor((await r.json().catch(() => ({}))).error) || t('No se pudo cambiar la contraseña.');
    } catch {
      return 'No se pudo conectar con el servidor.';
    }
  };

  const borrarCuenta = async (contrasena: string): Promise<string | null> => {
    try {
      const r = await conCookie('/api/cuenta/borrar', { method: 'POST', body: JSON.stringify({ contrasena }) });
      if (!r.ok) return tServidor((await r.json().catch(() => ({}))).error) || t('No se pudo borrar la cuenta.');
    } catch {
      return 'No se pudo conectar con el servidor.';
    }
    sincronizadoRef.current = false;
    setUsuarioCuenta(null);
    guardarLocal([], [], [], []);
    dispararToast(t('Cuenta borrada'));
    return null;
  };

  // Menú junto al corazón para elegir listas o quitar. Se ubica donde fue el último clic.
  const [menuGuardado, setMenuGuardado] = useState<{ nuevo: Guardable; recien: boolean; x: number; y: number } | null>(null);
  const ultimoClicRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const anotar = (e: PointerEvent) => {
      // Con la ampliación de pantallas grandes (zoom del html) las coordenadas fijas van en la escala sin ampliar
      const zoom = (document.documentElement as any).currentCSSZoom || 1;
      ultimoClicRef.current = { x: e.clientX / zoom, y: e.clientY / zoom };
    };
    window.addEventListener('pointerdown', anotar, true);
    return () => window.removeEventListener('pointerdown', anotar, true);
  }, []);
  const abrirMenuGuardado = (nuevo: Guardable, recien: boolean) => setMenuGuardado({ nuevo, recien, ...ultimoClicRef.current });

  // `alternar`: el botón muestra si el perfume está guardado (corazón): guarda al tiro y abre el menú de listas;
  // si ya estaba guardado, abre el menú, donde también se puede quitar.
  // `precioVerificado`: el precio es de una oferta consultada recién; si no (catálogo de otro día), el precio de
  // partida para avisar bajas lo pone la primera re-cotización, para no anunciar una baja o subida que no ocurrió.
  const guardarEnListaCompras = (
    nuevo: Omit<ItemListaCompra, 'id' | 'fechaGuardado'>,
    { alternar = false, precioVerificado = true }: { alternar?: boolean; precioVerificado?: boolean } = {},
  ) => {
    const existente = listaCompras.find(i => mismoGuardado(i, nuevo));
    if (existente && !alternar) {
      dispararToast(nuevo.ml ? t('"{p}" de {ml} ml ya está en tus Favoritos', { p: nuevo.perfume, ml: nuevo.ml }) : t('"{p}" ya está en tus Favoritos', { p: nuevo.perfume }));
      return;
    }
    if (existente) {
      abrirMenuGuardado(nuevo, false);
      return;
    }
    const hoy = new Date().toISOString().split('T')[0];
    const conPrecio = precioVerificado && !!nuevo.precioGuardado;
    const itemCompleto: ItemListaCompra = {
      ...nuevo,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fechaGuardado: hoy,
      ...(conPrecio ? { precioBase: nuevo.precioGuardado, fechaBase: hoy, precioActual: nuevo.precioGuardado, fechaPrecioActual: hoy } : {}),
    };
    const actualizada = [itemCompleto, ...listaCompras];
    setListaCompras(actualizada);
    try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(actualizada)); } catch {}
    registrarLogCliente('SUCCESS', 'LISTA_COMPRAS', `Guardado en lista: "${nuevo.perfume}" (${nuevo.tienda})`);
    if (alternar) abrirMenuGuardado(nuevo, true);
    else dispararToast(t('Guardado en Favoritos: {p}', { p: nuevo.perfume }));
  };

  const [actualizandoLista, setActualizandoLista] = useState(false);
  const actualizarPreciosLista = async (forzar = false) => {
    const hoy = new Date().toISOString().split('T')[0];
    const pendientes = listaCompras.filter(i => i.url && (forzar || i.fechaPrecioActual !== hoy));
    if (pendientes.length === 0 || actualizandoLista) return;
    setActualizandoLista(true);
    const nuevos = new Map<string, Partial<ItemListaCompra>>();
    // De a uno: son páginas de tiendas y no hay apuro
    for (const item of pendientes) {
      try {
        const r = await fetch(`${API_BASE}/api/cotizar?url=${encodeURIComponent(item.url)}&q=${encodeURIComponent(item.perfume)}`);
        const d = await r.json();
        const precio = typeof d.oferta?.precio === 'number' && d.oferta.precio > 0 ? d.oferta.precio : null;
        // Sin precio (tienda no soportada o producto retirado) se anota igual la fecha para no reintentar en el día
        nuevos.set(item.id, {
          precioActual: precio ?? item.precioActual ?? null,
          fechaPrecioActual: hoy,
          // Primer precio verificado: desde aquí se miden las bajas
          ...(precio && !item.precioBase ? { precioBase: precio, fechaBase: hoy } : {}),
        });
      } catch {
        break; // backend apagado: se vuelve a intentar en la próxima carga
      }
    }
    setListaCompras(prev => {
      const act = prev.map(i => (nuevos.has(i.id) ? { ...i, ...nuevos.get(i.id) } : i));
      try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(act)); } catch {}
      return act;
    });
    setActualizandoLista(false);
  };
  // Una vez al abrir la app, unos segundos después para no competir con la carga inicial
  useEffect(() => {
    const temporizador = setTimeout(() => actualizarPreciosLista(), 4000);
    return () => clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const bajaronDePrecio = listaCompras.filter(i => i.precioActual && i.precioBase && i.precioActual < i.precioBase).length;

  const eliminarDeListaCompras = (id: string) => {
    const actualizada = listaCompras.filter(i => i.id !== id);
    setListaCompras(actualizada);
    try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(actualizada)); } catch {}
  };

  const eliminarVariosDeLista = (ids: string[]) => {
    const actualizada = listaCompras.filter(i => !ids.includes(i.id));
    setListaCompras(actualizada);
    try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(actualizada)); } catch {}
  };

  const guardarItemsLista = (act: ItemListaCompra[]) => {
    setListaCompras(act);
    try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(act)); } catch {}
  };
  const nombreDeLista = (nombre: string) => nombre.trim().replace(/\s+/g, ' ').slice(0, 60);
  const crearListaPropia = (nombre: string): string | null => {
    const limpio = nombreDeLista(nombre);
    if (!limpio) return null;
    if (listasPropias.some(l => l.nombre.toLowerCase() === limpio.toLowerCase())) {
      dispararToast(t('Ya tienes una lista "{nombre}"', { nombre: limpio }));
      return null;
    }
    if (listasPropias.length >= 50) {
      dispararToast(t('Puedes tener hasta 50 listas'));
      return null;
    }
    const id = `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    setListasPropias(prev => [...prev, { id, nombre: limpio }]);
    dispararToast(t('Lista creada: {nombre}', { nombre: limpio }));
    return id;
  };
  const renombrarListaPropia = (id: string, nombre: string) => {
    const limpio = nombreDeLista(nombre);
    if (!limpio || listasPropias.some(l => l.id !== id && l.nombre.toLowerCase() === limpio.toLowerCase())) return;
    setListasPropias(listasPropias.map(l => (l.id === id ? { ...l, nombre: limpio } : l)));
  };
  // Borrar una lista no borra los perfumes: siguen en Mi Lista, solo salen de esa lista
  const borrarListaPropia = (id: string) => {
    setListasPropias(listasPropias.filter(l => l.id !== id));
    guardarItemsLista(listaCompras.map(i => (i.listas?.includes(id) ? { ...i, listas: i.listas.filter(x => x !== id) } : i)));
  };
  // Agregar varios a una lista propia (los que ya estaban, quedan una vez)
  const agregarAListaPropia = (ids: string[], listaId: string) => {
    setListaCompras(prev => {
      const act = prev.map(i => (ids.includes(i.id) && !i.listas?.includes(listaId) ? { ...i, listas: [...(i.listas || []), listaId] } : i));
      try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(act)); } catch {}
      return act;
    });
  };
  // Sacar varios de una lista propia: siguen en Favoritos
  const quitarDeListaPropia = (ids: string[], listaId: string) => {
    guardarItemsLista(listaCompras.map(i => (ids.includes(i.id) && i.listas?.includes(listaId) ? { ...i, listas: i.listas.filter(x => x !== listaId) } : i)));
  };
  const alternarEnListaPropia = (itemId: string, listaId: string) => {
    setListaCompras(prev => {
      const act = prev.map(i => {
        if (i.id !== itemId) return i;
        const actuales = i.listas || [];
        return { ...i, listas: actuales.includes(listaId) ? actuales.filter(x => x !== listaId) : [...actuales, listaId] };
      });
      try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(act)); } catch {}
      return act;
    });
  };

  const cambiarNotaLista = (id: string, notaPersonal: string) => {
    const actualizada = listaCompras.map(i => (i.id === id ? { ...i, notaPersonal } : i));
    setListaCompras(actualizada);
    try { localStorage.setItem('perfumescan_lista_compras', JSON.stringify(actualizada)); } catch {}
  };

  // ── Refresco diario de precios: avance para el indicador de la barra superior ──
  const [estadoRefresco, setEstadoRefresco] = useState<{
    enCurso: boolean;
    total: number;
    procesados: number;
    ultimo: { ultimo: string; perfumes: number; reCotizados: number } | null;
  } | null>(null);

  useEffect(() => {
    let activo = true;
    let enCursoAntes = false;
    let temporizador: number | undefined;
    const consultar = async () => {
      try {
        const datos = await (await fetch(`${API_BASE}/api/refresco`)).json();
        if (!activo) return;
        setEstadoRefresco(datos);
        // Al terminar un refresco, el catálogo vuelve a pedir los precios al backend
        if (enCursoAntes && !datos.enCurso) window.dispatchEvent(new Event('catalogo-actualizado'));
        enCursoAntes = datos.enCurso;
        temporizador = window.setTimeout(consultar, datos.enCurso ? 4000 : 60000);
      } catch {
        if (activo) temporizador = window.setTimeout(consultar, 60000);
      }
    };
    consultar();
    return () => {
      activo = false;
      window.clearTimeout(temporizador);
    };
  }, []);

  // Más de 24 h sin refrescar (backend apagado o recién iniciado): no se puede decir "al día"
  const refrescoVencido = Boolean(
    estadoRefresco?.ultimo && Date.now() - Date.parse(estadoRefresco.ultimo.ultimo) >= 24 * 60 * 60 * 1000
  );

  // ── Consola de Logs y Telemetría (Semana 5) ──
  const [mostrarModalLogs, setMostrarModalLogs] = useState(false);
  const [logsCliente, setLogsCliente] = useState<EntradaLogSistema[]>([
    {
      id: 'init-1',
      timestamp: new Date().toISOString(),
      nivel: 'INFO',
      modulo: 'FRONTEND',
      mensaje: 'Interfaz PerfumeScan v5.0 inicializada (Editorial UI + Alergias IFRA + Lista de Compras)',
    },
  ]);
  const [ultimaLatencia, setUltimaLatencia] = useState<{ ms: number; cache: boolean } | null>(null);

  const registrarLogCliente = (
    nivel: EntradaLogSistema['nivel'],
    modulo: string,
    mensaje: string,
    duracion_ms?: number
  ) => {
    setLogsCliente(prev => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        nivel,
        modulo,
        mensaje,
        duracion_ms,
      },
      ...prev.slice(0, 60),
    ]);
  };

  // Búsquedas recientes persistentes en LocalStorage
  const [busquedasRecientes, setBusquedasRecientes] = useState<string[]>(() => {
    try {
      const guardadas = localStorage.getItem('perfumescan_recientes');
      // Sin búsquedas guardadas se parte vacío: no se muestran (ni se usan para "Para ti") búsquedas que nadie hizo
      return guardadas ? JSON.parse(guardadas) : [];
    } catch {
      return [];
    }
  });

  const registrarBusquedaReciente = (term: string) => {
    try {
      const limpia = term.trim();
      if (limpia.length < 2) return;
      const actualizadas = [limpia, ...busquedasRecientes.filter(b => b.toLowerCase() !== limpia.toLowerCase())].slice(0, 6);
      setBusquedasRecientes(actualizadas);
      localStorage.setItem('perfumescan_recientes', JSON.stringify(actualizadas));
    } catch {}
  };

  const borrarRecientes = () => {
    setBusquedasRecientes([]);
    try { localStorage.removeItem('perfumescan_recientes'); } catch {}
  };

  // Estados de Búsqueda y Resultados
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [busquedaMostrada, setBusquedaMostrada] = useState('');
  const [mostrarModalFoto, setMostrarModalFoto] = useState(false);
  const [mostrarModalRango, setMostrarModalRango] = useState(false);
  const [mostrarIngredientes, setMostrarIngredientes] = useState(false);

  // Escape cierra cualquier ventana emergente abierta
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMostrarModalLista(false);
      setMostrarModalAlergias(false);
      setMostrarModalLogs(false);
      setMostrarModalFoto(false);
      setMostrarModalRango(false);
      setMostrarIngredientes(false);
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, []);
  const [archivoFoto, setArchivoFoto] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  // Al abrir un perfume del catálogo se consulta en segundo plano: mientras tanto puede llegar su ficha
  const [actualizandoVivo, setActualizandoVivo] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const [precios, setPrecios] = useState<PrecioMercado[] | null>(null);
  const [ficha, setFicha] = useState<FichaFragancia | null>(null);
  const [historial, setHistorial] = useState<RegistroHistorial[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  // Oferta que eligió el usuario; -1 mientras no elija ninguna (la que se abre se calcula más abajo)
  const [ofertaElegidaIdx, setProdActivoIdx] = useState<number>(-1);

  // ── Pila de Navegación (QoL: Retroceder a la búsqueda o inspección anterior) ──
  interface EstadoNavegacionPerfume {
    titulo: string;
    textoBusqueda: string;
    precios: PrecioMercado[] | null;
    ficha: FichaFragancia | null;
    historial: RegistroHistorial[];
    reviews: Review[];
    sucursales: Sucursal[];
    subPestana: 'precios' | 'ficha' | 'guia' | 'similares' | 'historial' | 'tiendas' | 'reviews';
  }
  const [pilaNavegacion, setPilaNavegacion] = useState<EstadoNavegacionPerfume[]>([]);

  const empujarVistaActualAPila = () => {
    if (precios || ficha) {
      const tituloActual = ficha?.nombre || textoBusqueda || t('Perfume anterior');
      setPilaNavegacion(prev => {
        const filtrada = prev.filter(p => p.titulo.toLowerCase() !== tituloActual.toLowerCase());
        return [
          {
            titulo: tituloActual,
            textoBusqueda,
            precios,
            ficha,
            historial,
            reviews,
            sucursales,
            subPestana,
          },
          ...filtrada,
        ].slice(0, 10);
      });
    }
  };

  const volverABusquedaAnterior = () => {
    if (pilaNavegacion.length === 0) return;
    const [anterior, ...resto] = pilaNavegacion;
    setPilaNavegacion(resto);
    setTextoBusqueda(anterior.textoBusqueda);
    setBusquedaMostrada(anterior.textoBusqueda);
    setPrecios(anterior.precios);
    setFicha(anterior.ficha);
    setHistorial(anterior.historial);
    setReviews(anterior.reviews);
    setSucursales(anterior.sucursales);
    setSubPestana(anterior.subPestana);
    setMensaje('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Parámetros para comparador
  const [compP1, setCompP1] = useState<string>('');
  const [compP2, setCompP2] = useState<string>('');
  // La oferta que se venía viendo al mandar cada perfume al comparador: el comparador abre esa misma (la identifica su
  // URL y su tamaño) en vez de la más barata que encuentre buscando por el nombre
  const [compOferta1, setCompOferta1] = useState<PrecioMercado | null>(null);
  const [compOferta2, setCompOferta2] = useState<PrecioMercado | null>(null);
  const abrirComparador = (a: string, ofertaA: PrecioMercado | null = null, b = '', ofertaB: PrecioMercado | null = null) => {
    setCompP1(a);
    setCompOferta1(ofertaA?.url ? ofertaA : null);
    setCompP2(b); // sin segundo, lo elige el usuario
    setCompOferta2(ofertaB?.url ? ofertaB : null);
    setVistaPrincipal('comparar');
  };

  // ── Filtros Interactivos M3 ──
  const [filtroGenero, setFiltroGenero] = useState<'todos' | 'hombre' | 'mujer' | 'unisex'>('todos');
  const [filtroPrecio, setFiltroPrecio] = useState<'todos' | 'economico' | 'medio' | 'premium'>('todos');
  const [filtroTienda, setFiltroTienda] = useState<'todas' | 'Falabella' | 'DBS Beauty Store' | 'Alisha Perfumes' | 'Farmacias Ahumada'>('todas');
  const [ordenPrecios, setOrdenPrecios] = useState<'asc' | 'desc'>('asc');

  // Identifica la consulta en vivo vigente: si el usuario abre otro perfume o busca otra cosa,
  // la respuesta tardía de la consulta anterior se descarta
  const solicitudVivoRef = useRef(0);
  // Corrección de tipeo aplicada a la última búsqueda ("savage dior" → "sauvage dior")
  const [correccion, setCorreccion] = useState<{ escrita: string; buscada: string } | null>(null);
  // URL de la oferta que el usuario eligió a mano, para no perderla cuando llegan ofertas de otra tienda
  const urlActivaRef = useRef<string | null>(null);
  // Oferta que se pidió abrir al buscar (la que se guardó en Mi Lista); un clic del usuario en otra oferta gana
  const urlPedidaRef = useRef<string | null>(null);
  const [preciosAnteriores, setPreciosAnteriores] = useState<Record<string, number>>({});
  const claveOferta = (p: { url: string; nombre: string }) => `${p.url}|${extraerMl(p.nombre) ?? ''}`;
  const [urlOfertaPreferida, setUrlOfertaPreferida] = useState<string | null>(null);

  const resetResultados = () => {
    setBusquedaMostrada('');
    setPreciosAnteriores({});
    solicitudVivoRef.current++;
    empujarVistaActualAPila();
    setPrecios(null); setFicha(null); setHistorial([]); setSucursales([]); setMensaje('');
    setCorreccion(null);
    setSubPestana('precios');
    setProdActivoIdx(-1);
  };

  // ── Inspector Instantáneo de Perfume desde el Catálogo (0ms sin esperar al scraper) ──
  const [catalogoEnMemoria, setCatalogoEnMemoria] = useState<FraganciaCatalogoItem[]>(CATALOGO_FRAGANCIAS_CHILE);

  // Perfumes guardados desde el catálogo cuando aún no tenían tienda: si hoy el catálogo la tiene (mismo nombre y
  // tamaño), se completan para que empiecen a seguir su precio. El precio de partida lo pone la primera consulta.
  const [listaCompletada, setListaCompletada] = useState(0);
  useEffect(() => {
    let cambio = false;
    const act = listaCompras.map(i => {
      if (i.url) return i;
      const c = catalogoEnMemoria.find(
        x => x.urlMejorPrecio && x.nombre.toLowerCase() === i.perfume.toLowerCase() && (!i.ml || !x.ml || x.ml === i.ml),
      );
      // Si ese producto ya está guardado con su enlace, no se completa (quedaría repetido)
      if (!c || listaCompras.some(o => o.url && mismoGuardado(o, { perfume: c.nombre, url: c.urlMejorPrecio!, ml: i.ml }))) return i;
      cambio = true;
      return { ...i, url: c.urlMejorPrecio!, tienda: c.tiendaMejorPrecio || i.tienda, concentracion: i.concentracion || c.concentracion, fechaPrecioActual: undefined };
    });
    if (cambio) {
      guardarItemsLista(act);
      setListaCompletada(n => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogoEnMemoria, listaCompras.length]);
  useEffect(() => {
    if (listaCompletada) actualizarPreciosLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaCompletada]);

  const inspeccionarPerfumeDelCatalogo = (
    item: FraganciaCatalogoItem,
    catalogoRef: FraganciaCatalogoItem[] = []
  ) => {
    empujarVistaActualAPila();
    if (catalogoRef.length > 0) {
      setCatalogoEnMemoria(catalogoRef);
    }
    setVistaPrincipal('explorar');
    setCargando(false);
    setTextoBusqueda(`${item.marca} ${item.nombre}`);
    setBusquedaMostrada(`${item.marca} ${item.nombre}`);
    setMensaje('');
    setProdActivoIdx(-1);

    const notasTxt = `${item.familia} ${(item.notas || []).join(' ')} ${(item.notasDetalle || []).join(' ')}`.toLowerCase();
    const calcDim = (base: number, kws: string[]) =>
      Math.min(96, base + kws.reduce((acc, k) => (notasTxt.includes(k) ? acc + 18 : acc), 0));

    const radar: DatosRadar = {
      frescura: calcDim(32, ['cítric', 'citric', 'marin', 'acuát', 'bergamota', 'limón', 'menta']),
      dulzor: calcDim(28, ['dulce', 'gourmand', 'vainilla', 'tonka', 'chocolate', 'cacao', 'caramelo', 'miel']),
      amaderado: calcDim(35, ['madera', 'amaderad', 'cedro', 'sándalo', 'oud', 'vetiver', 'pachul']),
      especiado: calcDim(26, ['especia', 'pimienta', 'canela', 'cardamomo', 'tabaco', 'cuero']),
      floral: calcDim(28, ['floral', 'rosa', 'jazmín', 'iris', 'lavanda', 'azahar']),
      intensidad: item.proyeccion === 'Bestia' ? 95 : item.proyeccion === 'Alta' ? 84 : 68,
    };

    const alergenosDetectados: AlergenoDetectado[] = (item.alergenosIds || [])
      .map(id => {
        const ref = CATALOGO_ALERGIAS_IFRA.find(a => a.id === id);
        if (!ref) return null;
        return {
          id: ref.id,
          compuesto_quimico: ref.compuesto,
          nombre_comun: ref.nombre,
          presente_en: (item.notasDetalle || item.notas || []).slice(0, 2).join(', ') || ref.keywords.slice(0, 3).join(', '),
          nivel_riesgo: ref.riesgo,
          descripcion: ref.explicacion,
        };
      })
      .filter(Boolean) as AlergenoDetectado[];

    const notasBase = item.notasDetalle && item.notasDetalle.length >= 2 ? item.notasDetalle : item.notas;
    // El catálogo no distingue niveles: se reparten en tercios sin repetir notas
    const tercio = Math.ceil(notasBase.length / 3);
    const notasSalida = notasBase.slice(0, tercio);
    const notasCorazon = notasBase.slice(tercio, tercio * 2);
    const notasFondo = notasBase.slice(tercio * 2);

    // Similares olfativos y por precio extraídos inteligentemente del propio catálogo
    const otros = catalogoRef.filter(c => c.id !== item.id && c.nombre.toLowerCase() !== item.nombre.toLowerCase());
    const similaresOlf = otros
      .filter(c => c.familia === item.familia || c.notas.some(n => item.notas.includes(n)))
      .slice(0, 3)
      .map(c => ({
        nombre: c.nombre,
        marca: c.marca,
        motivo: t('Comparte perfil {familia} y notas de {notas}.', { familia: c.familia.toLowerCase(), notas: (c.notasDetalle || c.notas).slice(0, 2).join(t(' y ')) }),
        precio_estimado: `$${c.precioReferencia.toLocaleString('es-CL')} CLP`,
      }));

    const similaresPrec = otros
      .filter(c => Math.abs(c.precioReferencia - item.precioReferencia) <= 25000)
      .slice(0, 3)
      .map(c => ({
        nombre: c.nombre,
        marca: c.marca,
        motivo: c.ml ? t('Alternativa en el mismo rango de presupuesto ({ml} ml).', { ml: c.ml }) : t('Alternativa en el mismo rango de presupuesto.'),
        precio_estimado: `$${c.precioReferencia.toLocaleString('es-CL')} CLP`,
      }));

    const fichaInstantanea: FichaFragancia = {
      nombre: item.nombre,
      marca: item.marca,
      concentracion: item.concentracion,
      familia_olfativa: item.familia,
      acordes_principales: item.notas,
      genero: item.genero,
      notas_salida: notasSalida,
      notas_corazon: notasCorazon,
      notas_fondo: notasFondo,
      duracion_horas: item.duracionHoras,
      proyeccion: item.proyeccion,
      sillage: `Estela ${item.proyeccion.toLowerCase()} de carácter ${item.familia.toLowerCase()} (~${item.duracionHoras} horas en piel)`,
      estaciones: item.estaciones || ['Otoño', 'Primavera'],
      ocasiones: [item.ocasion || 'Uso Diario', 'Salidas Especiales'],
      mejor_momento_dia: item.ocasion.includes('Noche') ? 'Tarde / Noche' : 'Mañana / Tarde',
      publico_objetivo: `Amantes de las fragancias ${item.familia.toLowerCase()} de la casa ${item.marca}.`,
      intensidad: item.proyeccion === 'Bestia' ? 'Muy Intenso' : item.proyeccion === 'Alta' ? 'Intenso' : 'Moderado',
      presentaciones_habituales: item.ml ? [`${item.ml} ml`] : [],
      radar_olfativo: radar,
      alergenos_detectados: alergenosDetectados,
      // Sin guía: armarla con una plantilla parecía una sugerencia hecha para el perfume. La pestaña muestra
      // consejos generales y lo dice.
      origen: 'catalogo',
      descripcion: t('{nombre} de {marca} ({conc}) pertenece a la familia {familia}. Destaca por su combinación de {notas}, ofreciendo una fijación aproximada de {h} horas y proyección {proy}.', {
        nombre: item.nombre, marca: item.marca, conc: `${item.concentracion}${item.ml ? `, ${item.ml}ml` : ''}`, familia: item.familia,
        notas: (item.notasDetalle || item.notas).join(', '), h: item.duracionHoras, proy: t(item.proyeccion).toLowerCase(),
      }),
      similares_olfativos: similaresOlf,
      similares_precio: similaresPrec,
    };

    const tiendaRef = item.tiendaMejorPrecio || 'Falabella';
    const ofertasIniciales: PrecioMercado[] = [
      {
        tienda: tiendaRef,
        // La concentración del catálogo puede ser estimada; solo se usan marca, nombre y ml
        nombre: `${item.marca} ${item.nombre}${item.ml ? ` ${item.ml}ml` : ''}`,
        precio: item.precioReferencia,
        moneda: 'CLP',
        stock: 'Sin verificar',
        url: item.urlMejorPrecio || `https://www.falabella.com/falabella-cl/search?Ntt=${encodeURIComponent(`${item.marca} ${item.nombre}`)}`,
        imagen: item.imagen,
      },
    ];

    // Sin historial inventado: solo se muestra historial cuando el backend lo tiene registrado.
    const historialSintetico: RegistroHistorial[] = [];

    const sucursalesRef: Sucursal[] = [
      {
        tienda: 'Falabella',
        nombre: 'Falabella Parque Arauco',
        direccion: 'Av. Pdte. Kennedy 5413, Las Condes',
        horario: 'Lun a Dom: 10:00 - 20:30',
        comuna: 'Las Condes',
        region: 'Metropolitana',
        telefono: '600 380 5000',
        lat: -33.4058,
        lng: -70.5792,
      },
      {
        tienda: 'DBS Beauty Store',
        nombre: 'DBS Costanera Center',
        direccion: 'Av. Andrés Bello 2425, Local 2110, Providencia',
        horario: 'Lun a Dom: 10:00 - 21:00',
        comuna: 'Providencia',
        region: 'Metropolitana',
        telefono: '+56 2 2273 0000',
        lat: -33.4175,
        lng: -70.6063,
      },
      {
        tienda: 'Alisha Perfumes',
        nombre: 'Alisha Perfumes Providencia',
        direccion: 'Av. Andrés Bello 2447, Providencia',
        horario: 'Lun a Dom: 10:00 - 20:30',
        comuna: 'Providencia',
        region: 'Metropolitana',
        telefono: '+56 9 8765 4322',
        lat: -33.4172,
        lng: -70.6071,
      },
      {
        tienda: 'Farmacias Ahumada',
        nombre: 'Farmacias Ahumada Huérfanos',
        direccion: 'Huérfanos 1055, Santiago Centro',
        horario: 'Lun a Sab: 08:30 - 21:00',
        comuna: 'Santiago',
        region: 'Metropolitana',
        telefono: '600 222 4000',
        lat: -33.4401,
        lng: -70.6506,
      },
    ];


    // Sin notas conocidas no se arma ficha: el radar y la pirámide serían inventados
    setFicha((item.notas || []).length > 0 ? fichaInstantanea : null);
    setPrecios(ofertasIniciales);
    setHistorial(historialSintetico);
    setSucursales(sucursalesRef);
    // Abrir la ficha con Características & Radar (datos del catálogo, no inventados)
    setSubPestana('ficha');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Se muestra al instante el precio indexado y en segundo plano se consulta a las tiendas en vivo
    const ofertaCatalogo = ofertasIniciales[0];
    const fechaIndexada = item.fechaPrecio ? t(' del {fecha}', { fecha: item.fechaPrecio }) : '';
    setMensaje(t('Precio indexado{fecha}. Actualizando en vivo en las 4 tiendas...', { fecha: fechaIndexada }));
    setUrlOfertaPreferida(ofertaCatalogo.url);
    const idSolicitud = ++solicitudVivoRef.current;
    setActualizandoVivo(true);
    fetch(`${API_BASE}/api/buscar?q=${encodeURIComponent(`${item.marca} ${item.nombre}`)}`)
      .then(r => r.json())
      .then(data => {
        if (idSolicitud !== solicitudVivoRef.current) return;
        setActualizandoVivo(false);
        // La ficha real (de la IA o de las tiendas) reemplaza al resumen del catálogo: trae más datos y su versión en
        // inglés. Antes se conservaba el resumen y, en inglés, sus notas quedaban en español sin aviso.
        if (data?.ficha) setFicha(prev => (!prev || prev.origen === 'catalogo' ? data.ficha : prev));
        const vivos: PrecioMercado[] = data?.success && Array.isArray(data.precios) ? data.precios : [];
        if (vivos.length === 0) {
          setMensaje(t('Sin ofertas en vivo para este perfume: se muestra el precio indexado{fecha}.', { fecha: fechaIndexada }));
          return;
        }
        // Se mantiene activo el producto que el usuario abrió (mismo tamaño y tienda), no el más barato
        const incluyeOferta = vivos.some(p => mismoProductoUrl(p.url, ofertaCatalogo.url));
        setPrecios(incluyeOferta ? vivos : [...vivos, ofertaCatalogo]);
        setUrlOfertaPreferida(ofertaCatalogo.url);
        if (Array.isArray(data.historial)) setHistorial(data.historial);
        if (Array.isArray(data.sucursales)) setSucursales(data.sucursales);
        if (incluyeOferta) {
          setMensaje(t('Precios actualizados en vivo: {n} ofertas en tiendas chilenas.', { n: vivos.length }));
          return;
        }
        // La búsqueda no lo trajo: se lee directamente la página del producto que abrió el usuario
        setMensaje(t('Precios actualizados en vivo: {n} ofertas. Consultando la página de este producto...', { n: vivos.length }));
        return fetch(`${API_BASE}/api/cotizar?url=${encodeURIComponent(ofertaCatalogo.url)}&q=${encodeURIComponent(`${item.marca} ${item.nombre}`)}`)
          .then(r => r.json())
          .then(res => {
            if (idSolicitud !== solicitudVivoRef.current) return;
            if (!res?.success || !res.oferta) {
              setMensaje(t('Precios actualizados en vivo: {n} ofertas. Este producto no se pudo consultar; su precio es el indexado{fecha}.', { n: vivos.length, fecha: fechaIndexada }));
              return;
            }
            const { precio, stock, ingredientes, notasTienda, alergenosDeclarados, ingredientesOrigen } = res.oferta;
            const actual: PrecioMercado = { ...ofertaCatalogo, precio, stock, ingredientes, notasTienda, alergenosDeclarados, ingredientesOrigen };
            setPrecios([...vivos, actual]);
            setUrlOfertaPreferida(ofertaCatalogo.url);
            setMensaje(t('Precios actualizados en vivo: {n} ofertas, incluido este producto leído desde su página.', { n: vivos.length + 1 }));
          })
          .catch(() => {
            // Los precios en vivo ya se muestran; solo falló la lectura de este producto
            if (idSolicitud === solicitudVivoRef.current) {
              setMensaje(t('Precios actualizados en vivo: {n} ofertas. Este producto no se pudo consultar; su precio es el indexado{fecha}.', { n: vivos.length, fecha: fechaIndexada }));
            }
          });
      })
      .catch(() => {
        if (idSolicitud === solicitudVivoRef.current) {
          setActualizandoVivo(false);
          setMensaje(t('No se pudo consultar en vivo: se muestra el precio indexado{fecha}.', { fecha: fechaIndexada }));
        }
      });
  };

  // ── Búsqueda por Texto ──────────────────────
  // `literal`: buscar exactamente lo escrito, sin corregir errores de tipeo
  // `sinCache`: volver a consultar a las tiendas y a la IA aunque la búsqueda se haya hecho hace poco ("Volver a intentar")
  const buscarPorNombre = async (terminoManual?: string, literal = false, urlPreferida?: string, sinCache = false) => {
    const termino = (terminoManual ?? textoBusqueda).trim();
    if (termino.length < 2) {
      setMensaje(t('Escribe al menos 2 caracteres para iniciar la búsqueda.'));
      return;
    }
    if (terminoManual) setTextoBusqueda(terminoManual);
    setVistaPrincipal('explorar');
    setCargando(true);
    setMensaje(t('Consultando stock en vivo en Falabella, DBS, Alisha y Ahumada para "{q}"...', { q: termino }));
    resetResultados();
    setBusquedaMostrada(termino);
    urlPedidaRef.current = urlPreferida || null;
    const idSolicitud = solicitudVivoRef.current;
    const inicio = Date.now();

    try {
      // La respuesta llega por partes (una línea JSON por evento): las ofertas de cada tienda apenas responde,
      // la ficha cuando está lista y al final el resultado completo. Así no se espera a la tienda más lenta.
      const resp = await fetch(`${API_BASE}/api/buscar-vivo?q=${encodeURIComponent(termino)}${literal ? '&literal=1' : ''}${sinCache ? '&nocache=1' : ''}`);
      let data: any = null;
      // Lo que se sabía de esta búsqueda (si se había hecho antes): se muestra al tiro y se compara al final
      const anticipo: { conocido: { fecha: string; precios: PrecioMercado[] } | null } = { conocido: null };
      const alLlegar = (evento: any) => {
        if (idSolicitud !== solicitudVivoRef.current) return; // el usuario ya inició otra búsqueda
        if (evento.tipo === 'corregida') setCorreccion({ escrita: termino, buscada: evento.consulta });
        else if (evento.tipo === 'conocidas') {
          anticipo.conocido = { fecha: evento.fecha, precios: evento.precios || [] };
          setPrecios(anticipo.conocido.precios.map(p => ({ ...p, deMemoria: true })));
          if (evento.ficha) setFicha(prev => prev ?? evento.ficha);
          if (Array.isArray(evento.historial)) setHistorial(evento.historial);
          setMensaje(t('Precios de {cuando}. Revisando si cambiaron en las 4 tiendas...', { cuando: haceCuanto(evento.fecha) }));
        }
        else if (evento.tipo === 'ficha') setFicha(evento.ficha);
        else if (evento.tipo === 'ofertas') {
          // Si ya eligió una oferta, sigue activa aunque lleguen otras más baratas
          if (urlActivaRef.current || urlPedidaRef.current) setUrlOfertaPreferida(urlActivaRef.current || urlPedidaRef.current);
          // Las ofertas de esta tienda reemplazan las que se sabían de ella
          const deEstaTienda = new Set((evento.ofertas as PrecioMercado[]).map(o => o.tienda));
          setPrecios(previos => [...(previos || []).filter(p => !(p.deMemoria && deEstaTienda.has(p.tienda))), ...evento.ofertas]);
          setMensaje(t('Ya hay ofertas. Siguen respondiendo las otras tiendas...'));
        } else if (evento.tipo === 'tiendas') setMensaje(t('Ya respondieron las tiendas. Terminando la ficha del perfume...'));
        else if (evento.tipo === 'fin') data = evento;
      };
      const lector = resp.body!.getReader();
      const decodificador = new TextDecoder();
      let pendiente = '';
      for (;;) {
        const { done, value } = await lector.read();
        pendiente += decodificador.decode(value, { stream: !done });
        const lineas = pendiente.split('\n');
        pendiente = done ? '' : lineas.pop()!;
        lineas.filter(l => l.trim()).forEach(l => alLlegar(JSON.parse(l)));
        if (done) break;
      }
      if (idSolicitud !== solicitudVivoRef.current) return;
      if (!data) throw new Error('respuesta incompleta');
      const duracion = data.latencia_ms ?? (Date.now() - inicio);
      // Ninguna tienda respondió (caída, bloqueo o un cambio en sus páginas): se quedan a la vista los precios que se
      // sabían, marcados con su fecha, en vez de reemplazarlos por "0 ofertas"
      const conocidoSinConfirmar = !(data.precios || []).length && anticipo.conocido?.precios.length ? anticipo.conocido : null;
      if (conocidoSinConfirmar) {
        data = { ...data, precios: conocidoSinConfirmar.precios.map(p => ({ ...p, deMemoria: false, sinConfirmarDesde: conocidoSinConfirmar.fecha })) };
        anticipo.conocido = null;
      }
      if (data.success && data.es_perfume !== false) {
        setMensaje(tn((data.precios || []).length, '{n} oferta encontrada en las tiendas ({s} s).', '{n} ofertas encontradas en las tiendas ({s} s).', { s: (duracion / 1000).toFixed(1) }));
        const conocido = anticipo.conocido;
        if (conocido) {
          // Qué cambió desde la búsqueda anterior: mismo producto (URL y tamaño) con otro precio
          const antes = new Map(conocido.precios.filter(p => p.precio).map(p => [claveOferta(p), p.precio as number]));
          const cambios: Record<string, number> = {};
          for (const p of (data.precios || []) as PrecioMercado[]) {
            const previo = antes.get(claveOferta(p));
            if (previo && p.precio && previo !== p.precio) cambios[claveOferta(p)] = previo;
          }
          setPreciosAnteriores(cambios);
          const n = Object.keys(cambios).length;
          setMensaje(n
            ? tn(n, 'Precios al día: {n} cambió desde {cuando} (marcado en su oferta).', 'Precios al día: {n} cambiaron desde {cuando} (marcados en cada oferta).', { cuando: haceCuanto(conocido.fecha) })
            : t('Precios al día: sin cambios desde {cuando}.', { cuando: haceCuanto(conocido.fecha) }));
        }
        if (conocidoSinConfirmar) setMensaje(t('Las tiendas no respondieron: se muestran los precios de {cuando}, que pueden haber cambiado.', { cuando: haceCuanto(conocidoSinConfirmar.fecha) }));
        if (urlActivaRef.current || urlPedidaRef.current) setUrlOfertaPreferida(urlActivaRef.current || urlPedidaRef.current);
        setPrecios(data.precios);
        setCorreccion(data.corregida ? { escrita: termino, buscada: data.corregida } : null);
        setUltimaLatencia({ ms: duracion, cache: Boolean(data.desde_cache) });
        registrarBusquedaReciente(data.corregida || termino);
        if (data.ficha) setFicha(data.ficha);
        if (data.historial) setHistorial(data.historial);
        if (data.sucursales) setSucursales(data.sucursales);
        // Auto-aprender la marca y fragancia buscada en el catálogo de filtros
        aprenderPerfumeEnCatalogoLocal(data.corregida || termino, data.precios || [], data.ficha || null);
        // El backend ya lo agregó al catálogo: sin esto el perfume nuevo aparecía recién al recargar la página
        window.dispatchEvent(new Event('catalogo-actualizado'));
        registrarLogCliente(
          data.desde_cache ? 'CACHE' : 'SUCCESS',
          'BUSCADOR',
          `Búsqueda "${termino}": ${data.precios?.length || 0} ofertas (${data.desde_cache ? 'Caché RAM' : 'Scraping en vivo'})`,
          duracion
        );
      } else {
        setMensaje(data.es_perfume === false
          ? t('"{q}" no corresponde a un perfume o fragancia. PerfumeScan está pensado solo para perfumes originales.', { q: termino })
          : tServidor(data.mensaje));
        registrarLogCliente('WARN', 'BUSCADOR', `Aviso en búsqueda "${termino}": ${data.mensaje}`, duracion);
      }
    } catch {
      if (idSolicitud !== solicitudVivoRef.current) return;
      setMensaje(t('No se pudo conectar con el servidor backend en el puerto 8000.'));
      registrarLogCliente('ERROR', 'BUSCADOR', `Servidor backend no respondió para "${termino}"`);
    } finally {
      if (idSolicitud === solicitudVivoRef.current) setCargando(false);
    }
  };

  // ── Búsqueda por Foto / Cámara ─────────────
  const analizarPorFoto = async () => {
    if (!archivoFoto) {
      setMensaje(t('Selecciona o captura una imagen del frasco primero.'));
      return;
    }
    setCargando(true);
    setMensaje(t('Analizando botella con visión computacional e IA...'));
    resetResultados();
    const inicio = Date.now();

    const formData = new FormData();
    formData.append('imagen', archivoFoto);

    try {
      const resp = await fetch(`${API_BASE}/api/analizar`, { method: 'POST', body: formData });
      const data = await resp.json();
      const dur = Date.now() - inicio;
      if (data.success) {
        setMensaje(tServidor(data.mensaje));
        setUltimaLatencia({ ms: dur, cache: false });
        if (data.analisis?.perfume) setTextoBusqueda(data.analisis.perfume);
        if (data.precios) setPrecios(data.precios);
        if (data.ficha) setFicha(data.ficha);
        if (data.historial) setHistorial(data.historial);
        if (data.sucursales) setSucursales(data.sucursales);
        if (data.analisis?.perfume) {
          aprenderPerfumeEnCatalogoLocal(
            `${data.analisis.marca || ''} ${data.analisis.perfume}`.trim(),
            data.precios || [],
            data.ficha || null
          );
        }
        setMostrarModalFoto(false);
        registrarLogCliente('SUCCESS', 'VISION_IA', `Foto analizada con éxito: "${data.analisis?.perfume}"`, dur);
      } else {
        setMensaje(tServidor(data.mensaje));
        registrarLogCliente('ERROR', 'VISION_IA', `Error al analizar foto: ${data.mensaje}`, dur);
      }
    } catch {
      setMensaje(t('Error de conexión con el servidor.'));
    } finally {
      setCargando(false);
    }
  };

  // ── Aplicación de Filtros en Tiempo Real ──
  const preciosFiltrados = (precios || [])
    .filter(item => {
      if (filtroTienda !== 'todas' && item.tienda !== filtroTienda) return false;
      if (filtroGenero !== 'todos') {
        const g = detectarGeneroProducto(item.nombre, ficha?.genero);
        if (g !== filtroGenero) return false;
      }
      if (filtroPrecio !== 'todos' && item.precio !== null) {
        if (filtroPrecio === 'economico' && item.precio >= 45000) return false;
        if (filtroPrecio === 'medio' && (item.precio < 45000 || item.precio > 85000)) return false;
        if (filtroPrecio === 'premium' && item.precio <= 85000) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const agotadoA = a.stock === 'Agotado' ? 1 : 0;
      const agotadoB = b.stock === 'Agotado' ? 1 : 0;
      if (agotadoA !== agotadoB) return agotadoA - agotadoB;
      // Primero el perfume buscado y después las otras versiones (al buscar "Bad Boy Elixir", el Cobalt o el EDT
      // más baratos quedaban antes que el Elixir)
      if (ficha) {
        const otroA = esMismoPerfume(ficha.nombre, a.nombre, ficha.marca, ficha.genero) ? 0 : 1;
        const otroB = esMismoPerfume(ficha.nombre, b.nombre, ficha.marca, ficha.genero) ? 0 : 1;
        if (otroA !== otroB) return otroA - otroB;
      }
      const pA = a.precio ?? (ordenPrecios === 'asc' ? Infinity : -Infinity);
      const pB = b.precio ?? (ordenPrecios === 'asc' ? Infinity : -Infinity);
      return ordenPrecios === 'asc' ? pA - pB : pB - pA;
    });

  // Sin elección del usuario se abre la oferta más barata del perfume buscado. La más barata de toda la búsqueda
  // puede ser otra versión ("Eros Flame" al buscar Eros): la ficha se ocultaba, a veces recién al llegar esa tienda.
  const idxDelPerfume = ficha
    ? preciosFiltrados.findIndex(p => esMismoPerfume(ficha.nombre, p.nombre, ficha.marca, ficha.genero))
    : -1;
  const prodActivoIdx = ofertaElegidaIdx >= 0 ? ofertaElegidaIdx : Math.max(0, idxDelPerfume);

  // Las reseñas son del perfume que se ve (el mismo título de la ficha: "Sauvage EDT" no es "Sauvage Elixir")
  const ofertaVista = preciosFiltrados[prodActivoIdx] || preciosFiltrados[0] || precios?.[0];
  const perfumeResenas = precios
    ? tituloConConcentracion(
        ficha ? nombreSegunOferta(ficha.nombre, ofertaVista?.nombre, ficha.marca) : ofertaVista?.nombre || textoBusqueda,
        ofertaVista?.nombre || '',
      )
    : '';
  const [resenasMias, setResenasMias] = useState<string[]>([]);
  useEffect(() => {
    // Fuera las del perfume anterior mientras llegan las de este
    setReviews([]);
    setResenasMias([]);
    if (!perfumeResenas) return;
    let vigente = true;
    fetch(`${API_BASE}/api/reviews?perfume=${encodeURIComponent(perfumeResenas)}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!vigente) return;
        setReviews(Array.isArray(d.reviews) ? d.reviews : []);
        setResenasMias(Array.isArray(d.mias) ? d.mias : []);
      })
      .catch(() => {});
    return () => { vigente = false; };
  }, [perfumeResenas, usuarioCuenta?.email]);
  const fichaAlergias = fichaConAlergenosDeOferta(ficha, preciosFiltrados[prodActivoIdx] || preciosFiltrados[0]);
  urlActivaRef.current = ofertaElegidaIdx >= 0 ? preciosFiltrados[ofertaElegidaIdx]?.url || null : null;

  const precioMinimo = preciosFiltrados
    .filter(p => p.precio !== null && p.stock !== 'Agotado')
    .reduce((min, p) => (p.precio! < min ? p.precio! : min), Infinity);

  // Al llegar ofertas nuevas, se deja activa la del producto abierto desde el catálogo (no la más barata)
  useEffect(() => {
    if (!urlOfertaPreferida || !precios) return;
    const idx = preciosFiltrados.findIndex(p => mismoProductoUrl(p.url, urlOfertaPreferida));
    if (idx >= 0) setProdActivoIdx(idx);
    setUrlOfertaPreferida(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precios, urlOfertaPreferida]);

  const totalAlergiasConfiguradas = alergiasUsuario.length + notasAlergiaCustom.length;

  // Direcciones propias: ?buscar=Sauvage%20Dior y ?vista=comparar&a=…&b=…, para compartir un perfume o una
  // comparación, usar Atrás del navegador y recargar sin perder la pantalla. La app sigue siendo una sola página.
  const parametros = new URLSearchParams();
  if (vistaPrincipal === 'comparar') {
    parametros.set('vista', 'comparar');
    if (compP1 && compP2) {
      parametros.set('a', compP1);
      parametros.set('b', compP2);
      if (compOferta1?.url) parametros.set('au', compOferta1.url);
      if (compOferta2?.url) parametros.set('bu', compOferta2.url);
    }
  } else if (busquedaMostrada) {
    parametros.set('buscar', busquedaMostrada);
  }
  const direccion = parametros.toString();
  // En la primera pantalla aún no se aplicó la dirección con que se abrió la app: escribirla la borraría
  const direccionLeidaRef = useRef(false);
  useEffect(() => {
    if (!direccionLeidaRef.current) {
      direccionLeidaRef.current = true;
      return;
    }
    const actual = new URLSearchParams(window.location.search);
    if (actual.toString() === direccion) return;
    // Cambiar de oferta en el comparador reemplaza la dirección: Atrás vuelve a la pantalla anterior, no a cada oferta
    const sinOfertas = (q: URLSearchParams) => {
      const c = new URLSearchParams(q);
      c.delete('au');
      c.delete('bu');
      return c.toString();
    };
    const soloOferta = sinOfertas(actual) === sinOfertas(new URLSearchParams(direccion));
    window.history[soloOferta ? 'replaceState' : 'pushState'](null, '', direccion ? `?${direccion}` : window.location.pathname);
  }, [direccion]);

  const aplicarDireccion = () => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('vista') === 'comparar') {
      if (p.get('a') && p.get('b')) {
        setCompP1(p.get('a')!);
        setCompP2(p.get('b')!);
        // Si ya se tiene esa oferta (Atrás dentro de la app), se conserva con sus datos
        const deDireccion = (url: string | null, previa: PrecioMercado | null) =>
          !url ? null : previa && mismoProductoUrl(previa.url, url) ? previa : ofertaSoloUrl(url);
        setCompOferta1((previa) => deDireccion(p.get('au'), previa));
        setCompOferta2((previa) => deDireccion(p.get('bu'), previa));
      }
      setVistaPrincipal('comparar');
      return;
    }
    const buscar = (p.get('buscar') || '').trim();
    if (buscar && buscar !== busquedaMostrada) return void buscarPorNombre(buscar);
    setVistaPrincipal('explorar');
    if (!buscar && busquedaMostrada) resetResultados();
  };
  // El listener se registra una vez; con la ref siempre usa el estado del último render
  const aplicarDireccionRef = useRef(aplicarDireccion);
  aplicarDireccionRef.current = aplicarDireccion;
  useEffect(() => {
    if (window.location.search) aplicarDireccionRef.current();
    const alVolver = () => aplicarDireccionRef.current();
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  const [idiomaUI, setIdiomaUI] = useState<Idioma>(idioma());
  const cambiarIdioma = (nuevo: Idioma) => {
    fijarIdioma(nuevo);
    setIdiomaUI(nuevo);
  };

  // "Para ti": todo lo guardado pesa igual, y algo más que las búsquedas recientes
  const recomendacionesParaTi = recomendarParaTi(
    catalogoEnMemoria,
    [
      ...listaCompras
        .map(i => ({ nombre: i.perfume, peso: 3 })),
      ...busquedasRecientes.map(b => ({ nombre: b, peso: 1 })),
    ],
    alergiasUsuario,
    notasAlergiaCustom
  );

  return (
    <div className="m3-app-shell">
      {/* ── Top Bar Editorial con Iluminación Ambiental y Iconografía Vectorial ── */}
      <header className="m3-top-bar">
        <div className="m3-brand-title">
          <span className="m3-brand-logo-mark">
            <Store size={22} strokeWidth={2} />
          </span>
          <span>PerfumeScan</span>
          <span className="m3-brand-badge">{t('Almacén de perfumes')}</span>
        </div>
        <p className="m3-brand-subtitle m3-hide-mobile">
          {t('Los precios de hoy en 4 tiendas de Chile, y lo que declara el envase de cada perfume.')}
        </p>

        {/* Barra de Herramientas Rápidas con Iconos Vectoriales Lucide */}
        <div className="m3-top-utility-bar">
          {/* Mi perfil: lista, alergias y cuenta en un solo botón */}
          <button
            type="button"
            className="m3-utility-pill"
            onClick={() => setMostrarModalCuenta(true)}
            title={[
              usuarioCuenta ? t('Entraste como {correo}', { correo: usuarioCuenta.email }) : t('Mi Lista, Mis Alergias y cuenta'),
              bajaronDePrecio > 0 ? tn(bajaronDePrecio, '{n} perfume de tu lista bajó de precio', '{n} perfumes de tu lista bajaron de precio') : '',
            ].filter(Boolean).join(' · ')}
            aria-label={t('Mi perfil: {n} en la lista, {a} alergias', { n: listaCompras.length, a: totalAlergiasConfiguradas })}
          >
            <UserRound size={15} strokeWidth={2.2} style={{ color: 'var(--m3-primary)' }} />
            <span className="m3-hide-mobile">{usuarioCuenta ? usuarioCuenta.email.split('@')[0] : t('Mi perfil')}</span>
            <ShoppingBag size={13} strokeWidth={2.2} style={{ color: 'var(--m3-text-secondary)' }} aria-hidden />
            <span className="m3-badge-counter">{listaCompras.length}</span>
            {totalAlergiasConfiguradas > 0 && (
              <>
                <ShieldAlert size={13} strokeWidth={2.2} style={{ color: '#dc2626' }} aria-hidden />
                <span className="m3-badge-counter" style={{ background: '#dc2626' }}>{totalAlergiasConfiguradas}</span>
              </>
            )}
            {bajaronDePrecio > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-success)' }}>↓ {bajaronDePrecio}</span>
            )}
          </button>

          {estadoRefresco && (estadoRefresco.enCurso || estadoRefresco.ultimo) && (
            <span
              className="m3-utility-pill"
              role="status"
              aria-live="polite"
              title={
                estadoRefresco.enCurso
                  ? t('Re-cotizando el catálogo en las 4 tiendas; la app se puede usar mientras tanto')
                  : t('Último refresco: {a} de {b} precios verificados en tienda', { a: estadoRefresco.ultimo?.reCotizados ?? 0, b: estadoRefresco.ultimo?.perfumes ?? 0 })
              }
            >
              <Activity size={15} strokeWidth={2.2} style={{ color: estadoRefresco.enCurso || refrescoVencido ? '#d97706' : '#15803d' }} />
              {estadoRefresco.enCurso ? (
                <>
                  <span>{t('Actualizando precios {a}/{b}', { a: estadoRefresco.procesados, b: estadoRefresco.total })}</span>
                  <span style={{ width: '54px', height: '5px', borderRadius: '3px', background: 'var(--m3-surface-container-high)', overflow: 'hidden', display: 'inline-block' }}>
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${estadoRefresco.total ? Math.round((estadoRefresco.procesados / estadoRefresco.total) * 100) : 0}%`,
                        background: 'var(--m3-primary)',
                        transition: 'width 0.4s',
                      }}
                    />
                  </span>
                </>
              ) : (
                <span>
                  {refrescoVencido
                    ? t('Precios del {fecha} · actualización pendiente', { fecha: new Date(estadoRefresco.ultimo!.ultimo).toLocaleDateString(localeFechas(), { day: '2-digit', month: '2-digit' }) })
                    : t('Precios al día · {fecha}', { fecha: new Date(estadoRefresco.ultimo!.ultimo).toLocaleString(localeFechas(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) })}
                </span>
              )}
            </span>
          )}

          <button
            type="button"
            className="m3-utility-pill"
            onClick={alternarTema}
            title={t('Cambiar entre el almacén de día y de noche')}
            aria-label={temaOscuro ? t('Modo Claro') : t('Modo Oscuro')}
          >
            {temaOscuro ? (
              <><Sun size={15} strokeWidth={2.2} style={{ color: '#fbbf24' }} /> <span className="m3-hide-mobile">{t('Modo Claro')}</span></>
            ) : (
              <><Moon size={15} strokeWidth={2.2} style={{ color: 'var(--m3-primary)' }} /> <span className="m3-hide-mobile">{t('Modo Oscuro')}</span></>
            )}
          </button>

          {/* Idioma: queda guardado en el navegador */}
          <div className="m3-utility-pill" role="group" aria-label={t('Idioma')} style={{ gap: '2px', padding: '3px' }}>
            {IDIOMAS.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => cambiarIdioma(i.id)}
                aria-pressed={idiomaUI === i.id}
                title={i.nombre}
                lang={i.id}
                style={{
                  border: 'none', cursor: 'pointer', borderRadius: '99px', padding: '3px 9px', fontSize: '11.5px', fontWeight: 800,
                  background: idiomaUI === i.id ? 'var(--m3-primary)' : 'transparent',
                  color: idiomaUI === i.id ? 'var(--m3-on-primary, #fff)' : 'var(--m3-text-secondary)',
                }}
              >
                {i.corto}
              </button>
            ))}
          </div>
        </div>

        {/* M3 Segmented Navigation */}
        <nav className="m3-nav-segmented">
          <button
            className={`m3-nav-btn ${vistaPrincipal === 'explorar' ? 'active' : ''}`}
            onClick={() => setVistaPrincipal('explorar')}
          >
            <Search size={15} strokeWidth={2.2} /> {t('Explorar')}<span className="m3-hide-mobile">{t('Fragancias')}</span>
          </button>
          <button
            className={`m3-nav-btn ${vistaPrincipal === 'comparar' ? 'active' : ''}`}
            onClick={() => setVistaPrincipal('comparar')}
          >
            <Scale size={15} strokeWidth={2.2} /> {t('Comparador')}<span className="m3-hide-mobile">{t('Frente a Frente')}</span>
          </button>
          <button
            className="m3-nav-btn"
            style={{ borderLeft: '1px solid var(--m3-outline-variant)' }}
            onClick={() => setMostrarModalRango(true)}
            title={t('Ver alcance de búsqueda y cobertura en Chile')}
          >
            <Compass size={15} strokeWidth={2.2} /> {t('Cobertura')}
          </button>
        </nav>
      </header>

      {/* ── Contenido Principal ── */}
      <main className="m3-content-body">
        {/* VISTA 1: EXPLORAR Y BUSCAR PERFUMES */}
        {vistaPrincipal === 'explorar' && (
          <div>
            {/* Unified Search Bar */}
            <div className="m3-search-bar">
              <span className="m3-search-icon">
                <Search size={19} strokeWidth={2.3} />
              </span>
              <CampoPerfume
                className="m3-search-input"
                placeholder={t('Busca por fragancia o casa perfumista (ej: Acqua Di Gio, Sauvage, Bleu de Chanel...)')}
                valor={textoBusqueda}
                alCambiar={setTextoBusqueda}
                alElegir={(nombre) => !cargando && buscarPorNombre(nombre)}
                alEnter={() => !cargando && buscarPorNombre()}
                grupos={gruposDePerfumes(listaCompras, busquedasRecientes, false, catalogoEnMemoria)}
              />
              {textoBusqueda && (
                <button className="m3-search-clear" onClick={() => setTextoBusqueda('')} title={t('Limpiar')}>
                  <X size={17} />
                </button>
              )}
              <button
                className={`m3-camera-trigger ${mostrarModalFoto ? 'active' : ''}`}
                onClick={() => setMostrarModalFoto(!mostrarModalFoto)}
                title={t('Escanear frasco con foto o cámara')}
              >
                <Camera size={16} strokeWidth={2.1} />
                <span className="m3-hide-mobile">{archivoFoto ? t('Foto lista') : t('Escanear')}</span>
              </button>
              <button
                className="m3-search-submit"
                onClick={() => buscarPorNombre()}
                disabled={cargando}
              >
                <Search size={16} strokeWidth={2.4} />
                <span className="m3-hide-mobile">{cargando ? t('Consultando...') : t('Cotizar')}</span>
              </button>
            </div>

            {/* Barra rápida de navegación hacia atrás cuando se está en el catálogo */}
            {!precios && !cargando && pilaNavegacion.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={volverABusquedaAnterior}
                  className="m3-chip"
                  style={{
                    background: 'var(--m3-primary-container)',
                    color: 'var(--m3-on-primary-container)',
                    borderColor: 'var(--m3-primary)',
                    fontWeight: 700,
                  }}
                >
                  ↶ {t('Volver a "{nombre}"', { nombre: pilaNavegacion[0].titulo })}
                </button>
                {pilaNavegacion.length > 1 && (
                  <span style={{ fontSize: '11.5px', color: 'var(--m3-text-tertiary)' }}>
                    {t('({n} inspecciones en tu historial de sesión)', { n: pilaNavegacion.length })}
                  </span>
                )}
              </div>
            )}

            {/* Expandable Photo Upload Sheet */}
            {mostrarModalFoto && (
              <div className="m3-photo-sheet">
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Camera size={17} /> {t('Identificación Visual de Frascos con IA')}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setArchivoFoto(f);
                  }}
                  style={{ fontSize: '13px', marginBottom: '10px' }}
                />
                {archivoFoto && (
                  <div style={{ marginTop: '8px' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#15803d', fontWeight: 600 }}>
                      {t('Archivo preparado: {nombre}', { nombre: archivoFoto.name })}
                    </p>
                    <button
                      onClick={analizarPorFoto}
                      disabled={cargando}
                      className="m3-btn m3-btn-primary"
                    >
                      {cargando ? t('Procesando visión IA...') : t('Analizar Frasco con IA')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Shimmer Skeleton Loader mientras carga en vivo */}
            {cargando && (
              <div>
                <p style={{
                  margin: '16px 0 6px 0', fontSize: '13px', color: 'var(--m3-primary)', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <Sparkles size={16} /> {mensaje}
                </p>
                {/* Con las primeras ofertas ya en pantalla no hace falta el esqueleto */}
                {!precios && (
                  <div className="m3-skeleton-grid">
                    {[1, 2, 3].map(n => (
                      <div key={n} className="m3-skeleton-card">
                        <div className="m3-skeleton-box" style={{ height: '22px', width: '45%' }} />
                        <div className="m3-skeleton-box" style={{ height: '150px', width: '100%' }} />
                        <div className="m3-skeleton-box" style={{ height: '20px', width: '85%' }} />
                        <div className="m3-skeleton-box" style={{ height: '38px', width: '100%', marginTop: 'auto' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Ninguna oferta es el perfume buscado: sin este aviso parecía que la ficha se había perdido */}
            {!cargando && ficha && precios && precios.length > 0 &&
              !precios.some(p => esMismoPerfume(ficha.nombre, p.nombre, ficha.marca, ficha.genero)) && (
                <p style={{ margin: '12px 0 0 0', padding: '10px 14px', fontSize: '13px', color: 'var(--m3-text-secondary)', border: '1px dashed var(--m3-outline)', borderRadius: 'var(--m3-shape-md)' }}>
                  {t('Ninguna de las 4 tiendas vende hoy')} <strong style={{ color: 'var(--m3-text-primary)' }}>{ficha.nombre}</strong>. {t('Las ofertas de abajo son otras versiones o productos parecidos, así que no muestran su ficha.')}
                </p>
              )}

            {/* Aviso de corrección de tipeo, con la salida para buscar exactamente lo escrito */}
            {correccion && (
              <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: 'var(--m3-text-secondary)' }}>
                {t('Mostrando resultados de')} <strong style={{ color: 'var(--m3-text-primary)' }}>{correccion.buscada}</strong>.{' '}
                <button
                  type="button"
                  onClick={() => buscarPorNombre(correccion.escrita, true)}
                  style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--m3-primary)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {t('Buscar “{q}” tal cual', { q: correccion.escrita })}
                </button>
              </p>
            )}

            {/* Mensaje de estado cuando terminó */}
            {!cargando && mensaje && (
              <p style={{
                margin: '14px 0 12px 0', fontSize: '12.5px', color: 'var(--m3-text-secondary)',
                background: 'var(--m3-surface-container-low)', padding: '9px 15px', borderRadius: '10px',
                border: '1px solid var(--m3-outline-variant)'
              }}>
                {mensaje}
              </p>
            )}

            {/* Semáforo de Alergias Siempre Visible al Buscar un Perfume */}
            {ficha && (
              <BannerSemaforoAlergia
                ficha={fichaAlergias}
                alergiasIds={alergiasUsuario}
                notasCustom={notasAlergiaCustom}
                onAbrirConfig={() => setMostrarModalAlergias(true)}
              />
            )}

            {/* ── VISTA DETALLE DE PRODUCTO ESTILO KNASTA (Todo en una sola página limpia y sin recortes) ── */}
            {precios && (() => {
              const ofertaActiva = preciosFiltrados[prodActivoIdx] || preciosFiltrados[0] || precios[0];
              // Oferta de la búsqueda que trae la lista del envase, para ofrecerla cuando la activa no la tiene
              const idxCompleta = preciosFiltrados.findIndex((o) => { const l = leerIngredientes(o.ingredientes); return l && !esListaResumida(l); });
              const idxIngredientes = idxCompleta >= 0 ? idxCompleta : preciosFiltrados.findIndex((o) => leerIngredientes(o.ingredientes));
              const lecturaActiva = leerIngredientes(ofertaActiva?.ingredientes);
              // La ficha (notas, radar, guía) es del perfume buscado: no se muestra para otra versión u otro perfume
              const otroPerfume = otroPerfumeDeOferta(ficha, ofertaActiva);
              const fichaPropia = otroPerfume ? null : ficha;
              const fichaVista = fichaParaMostrar(fichaPropia);
              const verIngredientes = () => {
                if (!lecturaActiva && idxIngredientes >= 0) setProdActivoIdx(idxIngredientes);
                setMostrarIngredientes(true);
              };
              const precioActual = ofertaActiva?.precio || precioMinimo || 0;
              const mlActivo = mlDeOferta(ofertaActiva);
              // La concentración la dice la tienda en el nombre de la oferta; la de la ficha es lo que estimó la IA
              // ("Bad Boy Elixir" decía "Parfum" mientras Falabella lo vende como EDP)
              const conConcentracionDeOferta = (f: FichaFragancia | null) => {
                const deOferta = extraerConcentracion(ofertaActiva?.nombre || '');
                return f && deOferta ? { ...f, concentracion: deOferta } : f;
              };
              const nombreTitulo = tituloConConcentracion(
                ficha ? nombreSegunOferta(ficha.nombre, ofertaActiva?.nombre, ficha.marca) : ofertaActiva?.nombre || textoBusqueda,
                ofertaActiva?.nombre || '',
              );
              // Solo el mismo producto en la misma tienda: otro tamaño, concentración o tienda no es un descuento
              const historialProducto = ofertaActiva
                ? historial.filter(
                    h =>
                      h.tienda === ofertaActiva.tienda &&
                      (h.nombre === ofertaActiva.nombre ||
                        // la página del producto lo nombra distinto que la búsqueda: mismo producto por URL y tamaño
                        (mismoProductoUrl(h.url, ofertaActiva.url) && (h.ml ?? null) === mlActivo))
                  )
                : [];
              const preciosHistValidos = historialProducto.map(h => h.precio).filter(p => p > 0);
              // Para decir por qué no hay historial: cuántos días tiene esta oferta y si otra del mismo perfume sí tiene
              const registrosDe = (o: PrecioMercado) => {
                const ml = mlDeOferta(o);
                return historial.filter(h => h.tienda === o.tienda && h.precio > 0 &&
                  (h.nombre === o.nombre || (mismoProductoUrl(h.url, o.url) && (h.ml ?? null) === ml)));
              };
              const diasDe = (o: PrecioMercado) => new Set(registrosDe(o).map(h => h.fecha));
              const diasOfertaActiva = ofertaActiva ? Array.from(diasDe(ofertaActiva)).sort() : [];
              const idxConHistorial = preciosFiltrados.findIndex(o =>
                o !== ofertaActiva && diasDe(o).size >= 2 &&
                (!ficha || esMismoPerfume(ficha.nombre, o.nombre, ficha.marca, ficha.genero)));
              const fechaCorta = (f: string) => f.split('-').reverse().slice(0, 2).join('/');
              // Solo hay análisis de precio si existe historial REAL registrado (mínimo 2 puntos)
              const hayHistorialReal = preciosHistValidos.length >= 2;
              const precioMaxHist = hayHistorialReal ? Math.max(...preciosHistValidos, precioActual) : precioActual;
              const precioMinHist = hayHistorialReal ? Math.min(...preciosHistValidos, precioActual) : precioActual;
              const precioHabitual = hayHistorialReal
                ? Math.round(preciosHistValidos.reduce((a, b) => a + b, 0) / preciosHistValidos.length)
                : precioActual;
              const ahorroReal = Math.max(0, precioMaxHist - precioActual);
              const pctBajoMax = precioMaxHist > 0 ? Math.round(((precioMaxHist - precioActual) / precioMaxHist) * 100) : 0;
              const yaGuardadoHero = !!ofertaActiva && estaEnLista({ perfume: ficha?.nombre || ofertaActiva.nombre, url: ofertaActiva.url || '', ml: mlDeOferta(ofertaActiva) });
              const imgHero = normalizarImagen(ofertaActiva?.imagen);
              const tiendaCorta = (ofertaActiva?.tienda || 'Falabella')
                .replace(' Beauty Store', '')
                .replace(' Perfumes', '')
                .replace('Farmacias ', '');

              // Perfumes relacionados extraídos del catálogo en memoria para la grilla inferior
              const nombreRef = (ficha?.nombre || textoBusqueda).toLowerCase();
              // La familia y las notas de la IA vienen en texto libre: se traducen a las etiquetas del catálogo
              const familiaFicha = fichaPropia ? familiaCatalogoDesde(fichaPropia.familia_olfativa || '') : null;
              const etiquetasFicha = fichaPropia
                ? etiquetasDePerfume(
                    [...(fichaPropia.notas_salida || []), ...(fichaPropia.notas_corazon || []), ...(fichaPropia.notas_fondo || [])],
                    fichaPropia.acordes_principales || [],
                  )
                : [];
              // Se excluye el mismo perfume aunque el catálogo lo nombre distinto (ej: "Eros" vs "Versace Eros")
              const nombresActuales = [nombreRef, textoBusqueda.toLowerCase()].filter(Boolean);
              const esElMismo = (c: FraganciaCatalogoItem) => {
                const n = c.nombre.toLowerCase();
                return nombresActuales.some(a => a.includes(n) || n.includes(a));
              };
              const relacionadosCatalogo = catalogoEnMemoria
                .filter(c => !esElMismo(c))
                .map(c => {
                  const motivos: string[] = [];
                  let puntos = 0;
                  if (familiaFicha && familiaFicha !== 'Sin clasificar' && c.familia === familiaFicha) {
                    puntos += 3;
                    motivos.push(t('Misma familia'));
                  }
                  const comunes = c.notas.filter(n => etiquetasFicha.includes(n));
                  if (comunes.length > 0) {
                    puntos += 2 * comunes.length;
                    motivos.push(t('Notas: {notas}', { notas: comunes.slice(0, 2).map(n => n.split(/ \(| \//)[0]).join(', ') }));
                  }
                  if (ficha && c.marca.toLowerCase() === ficha.marca.toLowerCase()) {
                    puntos += 1;
                    motivos.push(t('Misma marca'));
                  }
                  if (precioActual > 0 && Math.abs(c.precioReferencia - precioActual) / precioActual <= 0.25) {
                    puntos += 2;
                    motivos.push(t('Precio similar'));
                  }
                  return { c, puntos, motivos };
                })
                .filter(r => r.puntos > 0)
                .sort((a, b) => b.puntos - a.puntos)
                .slice(0, 6);

              // Coordenadas SVG para el gráfico de área (solo con historial real)
              const puntosChart = hayHistorialReal ? historialProducto : [];
              const svgW = 620;
              const svgH = 220;
              const padL = 58;
              const padR = 18;
              const padT = 18;
              const padB = 32;
              const maxY = Math.round(precioMaxHist * 1.12);
              const minY = 0;
              const coords = puntosChart.map((pt, idx) => {
                const x = padL + (idx / Math.max(1, puntosChart.length - 1)) * (svgW - padL - padR);
                const y = padT + (1 - (pt.precio - minY) / Math.max(1, maxY - minY)) * (svgH - padT - padB);
                return { x, y, ...pt };
              });
              const polylinePoints = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
              const areaPath =
                coords.length > 0
                  ? `M ${coords[0].x.toFixed(1)} ${(svgH - padB).toFixed(1)} ` +
                    coords.map(c => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ') +
                    ` L ${coords[coords.length - 1].x.toFixed(1)} ${(svgH - padB).toFixed(1)} Z`
                  : '';

              return (
                <div className="knasta-detail-container">
                  {/* 1. Barra Superior de Breadcrumb + Retroceso (Con flex-wrap para que nunca se corte) */}
                  <nav className="knasta-breadcrumb-bar" aria-label={t('Navegación de ficha de producto')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={resetResultados}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--m3-text-primary)',
                          fontWeight: 800,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          padding: '2px 4px',
                        }}
                      >
                        ← {t('Volver')}
                      </button>
                      <span style={{ color: 'var(--m3-outline)' }}>|</span>
                      <button
                        type="button"
                        onClick={resetResultados}
                        style={{ border: 'none', background: 'transparent', color: 'var(--m3-text-secondary)', fontSize: '12px', cursor: 'pointer' }}
                      >
                        {t('Perfumes y Fragancias')}
                      </button>
                      <span style={{ color: 'var(--m3-text-tertiary)' }}>›</span>
                      <span style={{ color: 'var(--m3-text-secondary)', fontSize: '12px' }}>
                        {fichaVista?.familia_olfativa || t('Catálogo Chile')}
                      </span>
                      <span style={{ color: 'var(--m3-text-tertiary)' }}>›</span>
                      <strong style={{ color: 'var(--m3-primary)', fontSize: '12px' }}>
                        {ficha?.marca || t('Perfumería')}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {pilaNavegacion.length > 0 && (
                        <button
                          type="button"
                          onClick={volverABusquedaAnterior}
                          className="m3-chip"
                          style={{
                            padding: '5px 11px',
                            fontSize: '11.5px',
                            borderColor: 'var(--m3-primary)',
                            color: 'var(--m3-primary)',
                            fontWeight: 700,
                          }}
                        >
                          ↶ {t('Volver a "{nombre}"', { nombre: pilaNavegacion[0].titulo.length > 24 ? pilaNavegacion[0].titulo.slice(0, 24) + '…' : pilaNavegacion[0].titulo })}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => buscarPorNombre(ficha ? `${ficha.marca} ${ficha.nombre}` : textoBusqueda)}
                        className="m3-chip"
                        style={{ padding: '5px 11px', fontSize: '11.5px', fontWeight: 700 }}
                        title={t('Buscar ofertas en vivo en Falabella, DBS, Alisha y Farmacias Ahumada')}
                      >
                        <Search size={12} /> {t('Buscar en las 4 tiendas en vivo')}
                      </button>
                    </div>
                  </nav>

                  {/* 2. Bloque Hero Principal 2 Columnas Estilo Knasta */}
                  <div className="knasta-hero-split">
                    {/* Columna Izquierda: Vitrina Blanca con Botones Flotantes */}
                    <div className="knasta-hero-gallery">
                      <div className="knasta-hero-floating-actions">
                        <button
                          type="button"
                          className="knasta-floating-circle-btn"
                          title={yaGuardadoHero ? t('Guardado en tus Favoritos') : t('Guardar en Favoritos')}
                          onClick={() =>
                            guardarEnListaCompras({
                              perfume: ficha?.nombre || ofertaActiva?.nombre || textoBusqueda,
                              marca: ficha?.marca,
                              tienda: ofertaActiva?.tienda || 'Falabella',
                              precioGuardado: precioActual,
                              ml: mlDeOferta(ofertaActiva),
                              url: ofertaActiva?.url || '',
                              imagen: imgHero,
                              notaPersonal: ficha ? `${ficha.familia_olfativa} · ~${ficha.duracion_horas}h` : '',
                            }, { alternar: true })
                          }
                        >
                          <Heart size={16} fill={yaGuardadoHero ? '#ef4444' : 'none'} color={yaGuardadoHero ? '#ef4444' : '#ffffff'} />
                        </button>
                        <button
                          type="button"
                          className="knasta-floating-circle-btn"
                          title={t('Comparar frente a frente (VS)')}
                          onClick={() => {
                            // Se compara la oferta abierta: si es otra versión ("Eros Flame" en la ficha de Eros), por su nombre
                            const otro = ficha && ofertaActiva ? otroPerfumeDeOferta(ficha, ofertaActiva) : null;
                            const nombre = ficha
                              ? terminoDeBusqueda(otro || ficha.nombre, ficha.marca)
                              : textoBusqueda;
                            abrirComparador(nombre, ofertaActiva ?? null);
                          }}
                        >
                          <Scale size={16} />
                        </button>
                        {ofertaActiva?.url && (
                          <a
                            href={ofertaActiva.url}
                            target="_blank"
                            rel="noreferrer"
                            className="knasta-floating-circle-btn"
                            title={t('Abrir en {tienda}', { tienda: ofertaActiva.tienda })}
                            style={{ textDecoration: 'none' }}
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>

                      {imgHero ? (
                        <img
                          src={imgHero}
                          alt={ficha?.nombre || textoBusqueda}
                          style={{ maxWidth: '240px', maxHeight: '260px', objectFit: 'contain' }}
                        />
                      ) : (
                        <BottlePlaceholder size={120} />
                      )}

                      {/* Indicadores de ofertas disponibles */}
                      {preciosFiltrados.length > 1 && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
                          {preciosFiltrados.slice(0, 6).map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setProdActivoIdx(idx)}
                              style={{
                                width: idx === prodActivoIdx ? '18px' : '7px',
                                height: '7px',
                                borderRadius: '99px',
                                border: 'none',
                                background: idx === prodActivoIdx ? '#1e293b' : '#cbd5e1',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              title={t('Ver oferta #{n}', { n: idx + 1 })}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Columna Derecha: Información de Precio, Ahorro y Botón Visitar Tienda */}
                    <div className="knasta-hero-info">
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--m3-text-tertiary)', fontWeight: 700 }}>
                          {ficha?.marca || t('Perfumería Original')}
                        </span>
                        <h2
                          style={{
                            margin: '3px 0 10px 0',
                            fontSize: '1.25rem',
                            fontWeight: 800,
                            color: 'var(--m3-text-primary)',
                            lineHeight: 1.3,
                          }}
                        >
                          {nombreTitulo}{mlActivo ? ` ${mlActivo} ml` : ''} | {tiendaCorta}
                        </h2>

                        {/* Fila Precio Principal (+ tachado y % solo si hay historial real) */}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                          <span style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--m3-text-primary)', letterSpacing: '-0.02em' }}>
                            {precioActual > 0 ? `$ ${precioActual.toLocaleString('es-CL')}` : t('Precio no disponible')}
                          </span>
                          <span
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: '999px',
                              background: 'var(--m3-surface-container-high)',
                              color: mlActivo ? 'var(--m3-text-primary)' : 'var(--m3-text-tertiary)',
                            }}
                          >
                            {mlActivo
                              ? `${mlActivo} ml · ${calcularPrecioPorMl(precioActual, mlActivo) ?? ''}`
                              : t('Tamaño no indicado por la tienda')}
                          </span>
                          {hayHistorialReal && pctBajoMax > 0 && (
                            <>
                              <span style={{ fontSize: '13.5px', color: 'var(--m3-text-tertiary)', textDecoration: 'line-through' }}>
                                $ {precioMaxHist.toLocaleString('es-CL')}
                              </span>
                              <span className="knasta-discount-badge" style={{ fontSize: '12px', padding: '3px 9px' }}>
                                ↘ {pctBajoMax}%
                              </span>
                            </>
                          )}
                        </div>

                        {/* Caja de Origen del Dato: de dónde sale el precio */}
                        <div
                          style={{
                            border: '1px solid var(--m3-outline-variant)',
                            background: 'var(--m3-surface-container-low)',
                            borderRadius: '12px',
                            padding: '12px 14px',
                          }}
                        >
                          <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--m3-text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Store size={14} /> {t('Fuente del precio: {tienda}', { tienda: ofertaActiva?.tienda || tiendaCorta })}
                          </div>
                          <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--m3-text-secondary)', lineHeight: 1.45 }}>
                            {t('Precio publicado en la ficha del producto en {tienda}', { tienda: ofertaActiva?.tienda || tiendaCorta })}
                            {ofertaActiva?.nombre ? <> (“{ofertaActiva.nombre}”)</> : null}. {t('Puede cambiar: confirma el valor final en la tienda.')}
                          </p>
                          {ofertaActiva?.url && (
                            <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: 'var(--m3-text-tertiary)', wordBreak: 'break-all' }}>
                              {ofertaActiva.url.replace(/^https?:\/\//, '').split('?')[0].slice(0, 80)}
                            </p>
                          )}
                          {hayHistorialReal && ahorroReal > 0 && (
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#65a30d', fontWeight: 700 }}>
                              {t('{pct}% bajo el precio más alto que registramos (${precio}).', { pct: pctBajoMax, precio: precioMaxHist.toLocaleString('es-CL') })}
                            </p>
                          )}
                          {fichaPropia && (
                            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--m3-text-tertiary)' }}>
                              {extraerConcentracion(ofertaActiva?.nombre || '') || fichaPropia.concentracion} · {t('Familia {familia} · Duración aprox. ~{h}h (referencial).', { familia: fichaVista!.familia_olfativa, h: fichaPropia.duracion_horas })}
                            </p>
                          )}
                          {ofertaActiva?.notasTienda && (
                            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                              <strong>{t('Notas según {tienda}:', { tienda: ofertaActiva.tienda })}</strong> {ofertaActiva.notasTienda}
                            </p>
                          )}
                        </div>

                        {/* Selector rápido si hay varias tiendas cotizadas */}
                        {preciosFiltrados.length > 1 && (
                          <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {preciosFiltrados.slice(0, 4).map((of, i) => (
                              <button
                                key={i}
                                type="button"
                                title={of.nombre}
                                aria-pressed={i === prodActivoIdx}
                                onClick={() => setProdActivoIdx(i)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '8px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  border: i === prodActivoIdx ? '1.5px solid var(--m3-text-primary)' : '1px solid var(--m3-outline-variant)',
                                  background: i === prodActivoIdx ? 'var(--m3-surface-container-high)' : 'var(--m3-surface-container)',
                                  color: 'var(--m3-text-primary)',
                                }}
                              >
                                {of.tienda.replace(' Beauty Store', '').replace(' Perfumes', '')}
                                {mlDeOferta(of) ? ` · ${mlDeOferta(of)} ml` : ''} · ${(of.precio || 0).toLocaleString('es-CL')}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Botones CTA Principales */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                        {(lecturaActiva || idxIngredientes >= 0) && (
                          <button
                            type="button"
                            onClick={verIngredientes}
                            style={{ width: '100%', padding: '11px 16px', borderRadius: '9px', border: '1.5px solid var(--m3-primary)', background: 'var(--m3-primary-container)', color: 'var(--m3-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', textAlign: 'left' }}
                          >
                            <Droplets size={18} style={{ flexShrink: 0 }} />
                            <span style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 800, fontSize: '13.5px' }}>{t('Ver ingredientes y cantidades')}</span>
                              <span style={{ fontWeight: 600, fontSize: '11.5px', opacity: 0.85 }}>
                                {lecturaActiva
                                  ? esListaResumida(lecturaActiva)
                                    ? t('Lista resumida por {tienda}: no muestra los alérgenos', { tienda: ofertaActiva?.tienda ?? '' })
                                    : t('{n} ingredientes · {a} alérgenos declarados', { n: lecturaActiva.items.length, a: lecturaActiva.items.filter((i) => i.tipo === 'alergeno').length }) + (ofertaActiva?.ingredientesOrigen ? t(' · de otra presentación') : '')
                                  : t('Esta oferta no los publica: ver los de {tienda}', { tienda: preciosFiltrados[idxIngredientes].tienda })}
                              </span>
                            </span>
                          </button>
                        )}
                        {mostrarIngredientes && lecturaActiva && (
                          <ModalIngredientes
                            oferta={ofertaActiva}
                            concentracion={extraerConcentracion(ofertaActiva.nombre || '') || ficha?.concentracion}
                            alCerrar={() => setMostrarIngredientes(false)}
                          />
                        )}
                        <a
                          href={ofertaActiva?.url || `https://www.falabella.com/falabella-cl/search?Ntt=${encodeURIComponent(ficha?.nombre || textoBusqueda)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="knasta-cta-green"
                          style={{ padding: '12px 18px', fontSize: '13.5px', textDecoration: 'none' }}
                        >
                          {t('Visitar {tienda}', { tienda: tiendaCorta })} <ExternalLink size={15} />
                        </a>

                        <span style={{ textAlign: 'center', fontSize: '11px', color: 'var(--m3-text-tertiary)' }}>
                          {t('Guarda este perfume en tus Favoritos para seguir su precio')}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            guardarEnListaCompras({
                              perfume: ficha?.nombre || ofertaActiva?.nombre || textoBusqueda,
                              marca: ficha?.marca,
                              tienda: ofertaActiva?.tienda || 'Falabella',
                              precioGuardado: precioActual,
                              ml: mlDeOferta(ofertaActiva),
                              url: ofertaActiva?.url || '',
                              imagen: imgHero,
                              notaPersonal: ficha ? `${ficha.familia_olfativa} · ~${ficha.duracion_horas}h` : '',
                            }, { alternar: true })
                          }
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            borderRadius: '9px',
                            border: '1px solid var(--m3-primary)',
                            background: yaGuardadoHero ? 'var(--m3-primary-container)' : 'transparent',
                            color: 'var(--m3-primary)',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '7px',
                          }}
                        >
                          <ShoppingBag size={14} />
                          {yaGuardadoHero ? t('En Favoritos · te aviso si baja (listas o quitar)') : t('Guardar en Favoritos y avisarme si baja')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. Pestañas Tipo Carpeta (Flex-Wrap: Nunca se cortan fuera de pantalla) */}
                  <div>
                    <div className="knasta-folder-tabs">
                      <button
                        type="button"
                        className={`knasta-folder-tab ${subPestana === 'precios' ? 'active' : ''}`}
                        onClick={() => setSubPestana('precios')}
                      >
                        <Store size={15} /> {t('Todas las Tiendas ({n})', { n: preciosFiltrados.length })}
                      </button>
                      <button
                        type="button"
                        className={`knasta-folder-tab ${subPestana === 'historial' ? 'active' : ''}`}
                        onClick={() => setSubPestana('historial')}
                      >
                        <TrendingUp size={15} /> {t('Historial')}
                      </button>
                      <button
                        type="button"
                        className={`knasta-folder-tab ${subPestana === 'ficha' ? 'active' : ''}`}
                        onClick={() => setSubPestana('ficha')}
                      >
                        <Activity size={15} /> {t('A qué huele')}
                      </button>
                      {ficha && (
                        <>
                          <button
                            type="button"
                            className={`knasta-folder-tab ${subPestana === 'guia' ? 'active' : ''}`}
                            onClick={() => setSubPestana('guia')}
                          >
                            <Wind size={15} /> {t('Guía de Uso & ML')}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className={`knasta-folder-tab ${subPestana === 'tiendas' ? 'active' : ''}`}
                        onClick={() => setSubPestana('tiendas')}
                      >
                        <MapPin size={15} /> {t('Dónde conseguirlo')}
                      </button>
                      <button
                        type="button"
                        className={`knasta-folder-tab ${subPestana === 'reviews' ? 'active' : ''}`}
                        onClick={() => setSubPestana('reviews')}
                      >
                        <Star size={15} /> {t('Reseñas ({n})', { n: reviews.length })}
                      </button>
                    </div>

                    <div className="knasta-folder-panel">
                      {/* PESTAÑA 1 (sin datos): no se inventa historial */}
                      {subPestana === 'historial' && !hayHistorialReal && (
                        <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--m3-text-secondary)' }}>
                          <TrendingUp size={28} style={{ color: 'var(--m3-text-tertiary)', marginBottom: '8px' }} />
                          <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 800, color: 'var(--m3-text-primary)' }}>
                            {t('Todavía no hay historial de esta oferta')}
                          </p>
                          <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', lineHeight: 1.5 }}>
                            {t('El historial compara el mismo producto en la misma tienda y del mismo tamaño, y se muestra desde que hay precios de 2 días distintos.')}{' '}
                            {diasOfertaActiva.length === 1
                              ? t('Esta oferta tiene el precio de 1 día ({fecha}): el gráfico aparece cuando se registre otro día.', { fecha: fechaCorta(diasOfertaActiva[0]) })
                              : t('Esta oferta todavía no tiene precios registrados.')}
                            {' '}{t('El precio se registra cada vez que alguien busca el perfume y en la revisión diaria del catálogo.')}
                          </p>
                          {idxConHistorial >= 0 && (
                            <button
                              type="button"
                              className="m3-btn m3-btn-primary"
                              style={{ marginRight: '8px', marginBottom: '8px' }}
                              onClick={() => setProdActivoIdx(idxConHistorial)}
                            >
                              <TrendingUp size={13} /> {t('Ver la de {tienda}{ml}, que sí tiene historial', { tienda: preciosFiltrados[idxConHistorial].tienda, ml: mlDeOferta(preciosFiltrados[idxConHistorial]) ? ` ${mlDeOferta(preciosFiltrados[idxConHistorial])} ml` : '' })}
                            </button>
                          )}
                          <button
                            type="button"
                            className="m3-btn m3-btn-tonal"
                            onClick={() => buscarPorNombre(ficha ? `${ficha.marca} ${ficha.nombre}` : textoBusqueda)}
                          >
                            <Search size={13} /> {t('Buscar en las 4 tiendas en vivo')}
                          </button>
                        </div>
                      )}

                      {/* PESTAÑA 1: HISTORIAL REAL + ANÁLISIS DEL PRECIO LADO A LADO */}
                      {subPestana === 'historial' && hayHistorialReal && (
                        <div className="knasta-history-split">
                          {/* Gráfico de Área Izquierdo */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '12px' }}>
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--m3-text-tertiary)' }}>{t('Fecha')}</div>
                                <strong style={{ fontSize: '14px', color: 'var(--m3-text-primary)' }}>{historialProducto[historialProducto.length - 1]?.fecha || '—'}</strong>
                              </div>
                              <div style={{ width: '1px', height: '28px', background: 'var(--m3-outline-variant)' }} />
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--m3-text-tertiary)' }}>{t('Precio')}</div>
                                <strong style={{ fontSize: '14px', color: 'var(--m3-text-primary)' }}>
                                  $ {precioActual.toLocaleString('es-CL')}
                                </strong>
                              </div>
                            </div>

                            <div style={{ width: '100%', overflowX: 'auto' }}>
                              <svg
                                viewBox={`0 0 ${svgW} ${svgH}`}
                                style={{ width: '100%', height: 'auto', minHeight: '200px', display: 'block' }}
                              >
                                <defs>
                                  <linearGradient id="knastaAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--m3-primary)" stopOpacity="0.42" />
                                    <stop offset="100%" stopColor="var(--m3-primary)" stopOpacity="0.03" />
                                  </linearGradient>
                                </defs>

                                {[0, 0.25, 0.5, 0.75, 1].map((step, idx) => {
                                  const y = padT + step * (svgH - padT - padB);
                                  const val = Math.round(maxY * (1 - step) / 1000) * 1000;
                                  return (
                                    <g key={idx}>
                                      <line
                                        x1={padL}
                                        y1={y}
                                        x2={svgW - padR}
                                        y2={y}
                                        stroke="rgba(148, 163, 184, 0.16)"
                                        strokeWidth="1"
                                      />
                                      <text
                                        x={padL - 8}
                                        y={y + 4}
                                        textAnchor="end"
                                        fontSize="10"
                                        fill="#94a3b8"
                                      >
                                        ${val.toLocaleString('es-CL')}
                                      </text>
                                    </g>
                                  );
                                })}

                                {areaPath && <path d={areaPath} fill="url(#knastaAreaGrad)" />}
                                {polylinePoints && (
                                  <polyline
                                    fill="none"
                                    stroke="#60a5fa"
                                    strokeWidth="2.4"
                                    points={polylinePoints}
                                  />
                                )}

                                {coords.map((c, idx) => (
                                  <g key={idx}>
                                    <circle
                                      cx={c.x}
                                      cy={c.y}
                                      r={idx === coords.length - 1 ? 4.5 : 3}
                                      fill={idx === coords.length - 1 ? 'var(--m3-success)' : 'var(--m3-primary)'}
                                    />
                                    <text
                                      x={c.x}
                                      y={svgH - 8}
                                      textAnchor="middle"
                                      fontSize="10"
                                      fill="#94a3b8"
                                    >
                                      {c.fecha.slice(-5)}
                                    </text>
                                  </g>
                                ))}
                              </svg>
                            </div>
                          </div>

                          {/* Columna Derecha: Análisis del precio */}
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                            <div>
                              <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 800, color: 'var(--m3-text-primary)' }}>
                                {t('Análisis del precio')}
                              </h4>
                              <div className="knasta-good-moment-box">
                                <div style={{ fontSize: '12px', fontWeight: 800, color: precioActual <= precioHabitual ? 'var(--m3-success)' : '#f59e0b', marginBottom: '4px' }}>
                                  {precioActual <= precioHabitual ? `🕒 ${t('Bajo su precio promedio registrado')}` : `🕒 ${t('Sobre su precio promedio registrado')}`}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                  <strong style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--m3-text-primary)' }}>
                                    $ {precioActual.toLocaleString('es-CL')}
                                  </strong>
                                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--m3-success)' }}>
                                    {t('Ahorro real: $ {precio}', { precio: ahorroReal.toLocaleString('es-CL') })}
                                  </span>
                                </div>
                                <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--m3-text-secondary)', lineHeight: 1.45 }}>
                                  {t('Está {pct}% bajo su precio máximo según los {n} registros guardados de este producto en {tienda}.', { pct: pctBajoMax, n: historialProducto.length, tienda: ofertaActiva?.tienda ?? '' })}
                                </p>

                                <div
                                  style={{
                                    borderTop: '1px solid rgba(132, 204, 22, 0.28)',
                                    paddingTop: '10px',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '10px',
                                    fontSize: '11.5px',
                                  }}
                                >
                                  <div>
                                    <div style={{ color: 'var(--m3-text-tertiary)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                                      {t('PRECIO HABITUAL')}
                                    </div>
                                    <strong style={{ color: 'var(--m3-text-primary)', fontSize: '13px' }}>
                                      $ {precioHabitual.toLocaleString('es-CL')}
                                    </strong>
                                    <div style={{ color: 'var(--m3-text-tertiary)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginTop: '8px' }}>
                                      {t('MEJOR PRECIO')}
                                    </div>
                                    <strong style={{ color: 'var(--m3-text-primary)', fontSize: '13px' }}>
                                      $ {precioMinHist.toLocaleString('es-CL')}
                                    </strong>
                                  </div>
                                  <div>
                                    <div style={{ color: 'var(--m3-text-tertiary)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                                      {t('¿ESTUVO MÁS BARATO ANTES?')}
                                    </div>
                                    <strong style={{ color: 'var(--m3-text-primary)', fontSize: '12.5px' }}>
                                      {precioActual <= precioMinHist ? t('No, nunca') : t('Sí (${precio})', { precio: precioMinHist.toLocaleString('es-CL') })}
                                    </strong>
                                    <div style={{ color: 'var(--m3-text-tertiary)', fontSize: '10.5px', marginTop: '2px' }}>
                                      {t('en el período que revisamos')}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <a
                              href={ofertaActiva?.url || `https://www.falabella.com/falabella-cl/search?Ntt=${encodeURIComponent(ficha?.nombre || textoBusqueda)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="knasta-cta-green"
                              style={{ padding: '11px 16px', fontSize: '13px', textDecoration: 'none' }}
                            >
                              {t('Visitar {tienda}', { tienda: tiendaCorta })} <ExternalLink size={14} />
                            </a>
                          </div>
                        </div>
                      )}

                      {/* PESTAÑA 2: CARACTERÍSTICAS & RADAR 6D */}
                      {(subPestana === 'ficha' || subPestana === 'guia') && ficha && otroPerfume && (
                        <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--m3-text-secondary)' }}>
                          <Activity size={28} style={{ color: 'var(--m3-text-tertiary)', marginBottom: '8px' }} />
                          <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 800, color: 'var(--m3-text-primary)' }}>
                            {t('Esta oferta es {otro}, no {nombre}', { otro: otroPerfume, nombre: ficha.nombre })}
                          </p>
                          <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', lineHeight: 1.5 }}>
                            {t('Las notas, el radar y la guía de {nombre} no le corresponden, así que no se muestran aquí.', { nombre: ficha.nombre })}
                          </p>
                          <button
                            type="button"
                            className="m3-btn m3-btn-tonal"
                            onClick={() =>
                              // "Maison Azhar Your Way" ya trae su marca: anteponer la de la ficha buscaría otra cosa
                              buscarPorNombre(
                                (ofertaActiva?.nombre || '').toLowerCase().includes(ficha.marca.toLowerCase())
                                  ? `${ficha.marca} ${otroPerfume}`
                                  : otroPerfume,
                              )
                            }
                          >
                            <Search size={13} /> {t('Ver la ficha de {nombre}', { nombre: otroPerfume })}
                          </button>
                        </div>
                      )}
                      {/* Sin ficha: se dice por qué y se puede volver a intentar. Si la pestaña elegida era la guía o
                          la ficha, antes quedaba un recuadro vacío */}
                      {(subPestana === 'ficha' || subPestana === 'guia') && !ficha && (() => {
                        const enCamino = cargando || actualizandoVivo;
                        const bloqueada = (precios || []).some(o => o.detalleNoDisponible);
                        const termino = busquedaMostrada || (ofertaActiva ? terminoDeBusqueda(ofertaActiva.nombre) : textoBusqueda);
                        return (
                          <div style={{ padding: '26px 18px', textAlign: 'center', color: 'var(--m3-text-secondary)' }}>
                            <Activity size={26} style={{ color: 'var(--m3-text-tertiary)', marginBottom: '8px' }} />
                            <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 800, color: 'var(--m3-text-primary)' }}>
                              {enCamino ? t('Preparando la ficha de este perfume…') : t('Este perfume todavía no tiene ficha')}
                            </p>
                            {!enCamino && (
                              <>
                                <p style={{ margin: '0 auto 14px auto', fontSize: '12.5px', lineHeight: 1.55, maxWidth: '560px' }}>
                                  {bloqueada
                                    ? t('La IA no lo reconoce con certeza (suele pasar con los lanzamientos recientes) y Falabella no entregó la página del producto, que es de donde salen sus notas: suele ser un bloqueo de unos minutos.')
                                    : t('La IA no lo reconoce con certeza (suele pasar con los lanzamientos recientes) y las tiendas no publican sus notas.')}
                                  {' '}{t('PerfumeScan no inventa una ficha: prefiere no mostrar nada antes que la de otro perfume.')}
                                </p>
                                <button
                                  type="button"
                                  className="m3-btn m3-btn-tonal"
                                  onClick={() => buscarPorNombre(termino, false, ofertaActiva?.url || undefined, true)}
                                >
                                  <RefreshCw size={13} /> {bloqueada ? t('Volver a intentar en unos minutos') : t('Volver a intentar')}
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      {subPestana === 'ficha' && fichaPropia && (
                        <FichaFraganciaCard
                          ficha={fichaParaMostrar(conConcentracionDeOferta(fichaAlergias ?? fichaPropia))!}
                          onVerSimilares={() => {
                            const el = document.getElementById('seccion-relacionados-knasta');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          onGuardarFicha={() => {
                            guardarEnListaCompras({
                              perfume: fichaPropia.nombre,
                              marca: fichaPropia.marca,
                              tienda: ofertaActiva?.tienda || t('Por definir'),
                              precioGuardado: precioActual,
                              ml: mlDeOferta(ofertaActiva),
                              url: ofertaActiva?.url || '',
                              imagen: imgHero,
                              notaPersonal: `${fichaPropia.familia_olfativa} · ~${fichaPropia.duracion_horas}h`,
                            });
                          }}
                        />
                      )}
                      {/* PESTAÑA 3: GUÍA DE USO & ML */}
                      {subPestana === 'guia' && fichaPropia && (
                        <GuiaAplicacionCard
                          ficha={fichaParaMostrar(conConcentracionDeOferta(fichaPropia))!}
                          tamanos={Array.from(new Set(
                            (precios || [])
                              .filter(o => esMismoPerfume(fichaPropia.nombre, o.nombre, fichaPropia.marca, fichaPropia.genero))
                              .map(o => mlDeOferta(o))
                              .filter((ml): ml is number => !!ml),
                          )).sort((a, b) => a - b)}
                        />
                      )}

                      {/* PESTAÑA 4: SUCURSALES GPS */}
                      {subPestana === 'tiendas' && (
                        <SucursalesCard
                          sucursales={sucursales}
                          ofertas={(() => {
                            const propias = ficha ? (precios || []).filter(o => esMismoPerfume(ficha.nombre, o.nombre, ficha.marca, ficha.genero)) : [];
                            // Sin ficha no se sabe cuáles son del perfume: se usan todas. Con ficha, solo las suyas (pueden ser ninguna)
                            return ficha ? propias : precios || [];
                          })()}
                        />
                      )}

                      {/* PESTAÑA 5: RESEÑAS */}
                      {subPestana === 'reviews' && (
                        <ReviewsSection
                          perfumeNombre={perfumeResenas}
                          reviews={reviews}
                          mias={resenasMias}
                          cuenta={usuarioCuenta}
                          onEntrar={() => setMostrarModalCuenta(true)}
                          onCambio={(r, m) => { setReviews(r); setResenasMias(m); }}
                        />
                      )}

                      {/* PESTAÑA 6: TODAS LAS OFERTAS EN TIENDAS */}
                      {subPestana === 'precios' && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--m3-text-secondary)' }}>
                              {t('Mostrando {n} ofertas para "{nombre}"', { n: preciosFiltrados.length, nombre: ficha?.nombre || textoBusqueda })}
                            </p>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <select
                                value={filtroTienda}
                                onChange={e => setFiltroTienda(e.target.value as any)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--m3-outline-variant)',
                                  background: 'var(--m3-surface-container-lowest)',
                                  color: 'var(--m3-text-primary)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                <option value="todas">{t('Tienda: Todas')}</option>
                                <option value="Falabella">Falabella</option>
                                <option value="DBS Beauty Store">DBS Beauty Store</option>
                                <option value="Alisha Perfumes">Alisha Perfumes</option>
                                <option value="Farmacias Ahumada">Farmacias Ahumada</option>
                              </select>
                              <select
                                value={filtroPrecio}
                                onChange={e => setFiltroPrecio(e.target.value as any)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--m3-outline-variant)',
                                  background: 'var(--m3-surface-container-lowest)',
                                  color: 'var(--m3-text-primary)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                <option value="todos">{t('Precio: Todos')}</option>
                                <option value="economico">{'< $45.000'}</option>
                                <option value="medio">$45.000 - $85.000</option>
                                <option value="premium">{'> $85.000'}</option>
                              </select>
                              <select
                                value={filtroGenero}
                                onChange={e => setFiltroGenero(e.target.value as any)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--m3-outline-variant)',
                                  background: 'var(--m3-surface-container-lowest)',
                                  color: 'var(--m3-text-primary)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                <option value="todos">{t('Género: Todos')}</option>
                                <option value="hombre">{t('Masculino')}</option>
                                <option value="mujer">{t('Femenino')}</option>
                                <option value="unisex">Unisex</option>
                              </select>
                              <select
                                value={ordenPrecios}
                                onChange={e => setOrdenPrecios(e.target.value as 'asc' | 'desc')}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--m3-outline-variant)',
                                  background: 'var(--m3-surface-container-lowest)',
                                  color: 'var(--m3-text-primary)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                <option value="asc">{t('Menor Precio')}</option>
                                <option value="desc">{t('Mayor Precio')}</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => window.print()}
                                className="m3-btn m3-btn-tonal"
                                style={{ fontSize: '12px', padding: '7px 12px' }}
                              >
                                <Printer size={13} /> PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => buscarPorNombre(ficha ? `${ficha.marca} ${ficha.nombre}` : textoBusqueda)}
                                className="m3-btn m3-btn-primary"
                                style={{ fontSize: '12px', padding: '7px 14px' }}
                              >
                                <Search size={13} /> {t('Buscar en las 4 tiendas en vivo')}
                              </button>
                            </div>
                          </div>
                          <div className="precios-grid">
                            {preciosFiltrados.map((item, idx) => {
                              const yaGuardado = estaEnLista({ perfume: item.nombre, url: item.url, ml: extraerMl(item.nombre) });
                              return (
                                <TarjetaPrecio
                                  key={idx}
                                  item={item}
                                  esMenor={item.precio === precioMinimo}
                                  esSeleccionado={idx === prodActivoIdx}
                                  enListaCompras={yaGuardado}
                                  precioAnterior={preciosAnteriores[claveOferta(item)]}
                                  onSeleccionar={() => setProdActivoIdx(idx)}
                                  onGuardarLista={() =>
                                    guardarEnListaCompras({
                                      perfume: item.nombre,
                                      marca: ficha?.marca,
                                      tienda: item.tienda,
                                      precioGuardado: item.precio,
                                      ml: extraerMl(item.nombre),
                                      url: item.url,
                                      imagen: normalizarImagen(item.imagen),
                                      notaPersonal: '',
                                    }, { alternar: true })
                                  }
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Resumen de la ficha: en la pestaña Características ya están la descripción y la pirámide completas */}
                  {fichaPropia && subPestana !== 'ficha' && (
                    <div
                      style={{
                        background: 'var(--m3-surface-container-low)',
                        border: '1px solid var(--m3-outline-variant)',
                        borderRadius: '14px',
                        padding: '20px 22px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--m3-text-primary)' }}>
                          {fichaPropia.marca} {fichaPropia.nombre} ({fichaPropia.concentracion})
                        </h3>
                        <button
                          type="button"
                          onClick={() => setSubPestana('ficha')}
                          className="m3-btn m3-btn-tonal"
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          <Activity size={13} /> {t('Ver a qué huele y todas sus notas')}
                        </button>
                      </div>

                      <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: 'var(--m3-text-secondary)', lineHeight: 1.6 }}>
                        {fichaVista!.descripcion}
                      </p>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[...new Set([...(fichaVista!.notas_salida || []), ...(fichaVista!.notas_corazon || []), ...(fichaVista!.notas_fondo || [])])]
                          .slice(0, 6)
                          .map((nota, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: '11.5px',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                background: 'var(--m3-surface-container)',
                                color: 'var(--m3-text-primary)',
                                fontWeight: 600,
                              }}
                            >
                              ✦ {nota}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* 5. Barra "Prueba buscando otros productos en:" (Como en Screenshot 3) */}
                  {fichaPropia && (
                    <div
                      style={{
                        background: 'var(--m3-surface-container-low)',
                        border: '1px solid var(--m3-outline-variant)',
                        borderRadius: '12px',
                        padding: '12px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                        fontSize: '12.5px',
                      }}
                    >
                      <strong style={{ color: 'var(--m3-text-primary)' }}>{t('Prueba buscando otros perfumes en:')}</strong>
                      <button
                        type="button"
                        onClick={resetResultados}
                        className="m3-chip"
                        style={{ padding: '4px 10px', fontSize: '11.5px', color: 'var(--m3-primary)' }}
                      >
                        {fichaPropia.marca}
                      </button>
                      <button
                        type="button"
                        onClick={resetResultados}
                        className="m3-chip"
                        style={{ padding: '4px 10px', fontSize: '11.5px', color: 'var(--m3-primary)' }}
                      >
                        {fichaVista!.familia_olfativa}
                      </button>
                      {(fichaVista!.acordes_principales || []).slice(0, 2).map(ac => (
                        <button
                          key={ac}
                          type="button"
                          onClick={resetResultados}
                          className="m3-chip"
                          style={{ padding: '4px 10px', fontSize: '11.5px', color: 'var(--m3-primary)' }}
                        >
                          {ac}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 6. Grilla Inferior "Productos relacionados" Estilo Knasta (Screenshot 3) */}
                  {relacionadosCatalogo.length > 0 && (
                    <div
                      id="seccion-relacionados-knasta"
                      style={{
                        background: 'var(--m3-surface-container-low)',
                        border: '1px solid var(--m3-outline-variant)',
                        borderRadius: '14px',
                        padding: '20px 22px',
                      }}
                    >
                      <h3 style={{ margin: '0 0 14px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--m3-text-primary)' }}>
                        {t('Productos relacionados')}
                      </h3>
                      <div className="knasta-related-grid">
                        {relacionadosCatalogo.map(({ c: rel, motivos }) => {
                          const tiendaRel = (rel.tiendaMejorPrecio || 'Falabella')
                            .replace(' Beauty Store', '')
                            .replace(' Perfumes', '')
                            .replace('Farmacias ', '');
                          return (
                            <article
                              key={rel.id}
                              className="knasta-card"
                              onClick={() => inspeccionarPerfumeDelCatalogo(rel, catalogoEnMemoria)}
                              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                            >
                              <div className="knasta-img-stage" style={{ height: '165px', padding: '12px' }}>
                                <span className="knasta-store-pill" style={{ fontSize: '10px', padding: '3px 8px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--m3-primary)', display: 'inline-block' }} />
                                  {tiendaRel}
                                </span>
                                {rel.imagen ? (
                                  <img
                                    src={rel.imagen}
                                    alt={rel.nombre}
                                    style={{ maxWidth: '100%', maxHeight: '130px', objectFit: 'contain' }}
                                    loading="lazy"
                                  />
                                ) : (
                                  <BottlePlaceholder size={68} />
                                )}
                              </div>
                              <div className="knasta-card-body" style={{ padding: '10px 12px' }}>
                                <div>
                                  <span className="knasta-brand-text" style={{ fontSize: '10.5px' }}>{rel.marca}</span>
                                  <h4 className="knasta-product-title" style={{ fontSize: '12.5px' }}>{rel.nombre}</h4>
                                </div>
                                <div>
                                  <strong style={{ display: 'block', fontSize: '1.05rem', color: 'var(--m3-text-primary)', marginTop: '4px' }}>
                                    $ {rel.precioReferencia.toLocaleString('es-CL')}
                                  </strong>
                                  <div style={{ fontSize: '10.5px', color: 'var(--m3-text-secondary)', marginTop: '2px' }}>
                                    {motivos.join(' · ')}
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── ESTADO INICIAL HERO: ASISTENTE SOMMELIER + CATÁLOGO CURADO (siempre montado para conservar página y filtros) ── */}
            <div style={{ marginTop: '24px', display: !precios && !cargando ? 'block' : 'none' }}>
                <QuizDescubridor
                  alergiasUsuario={alergiasUsuario}
                  notasPersonalizadas={notasAlergiaCustom}
                  onBuscar={(nombre) => buscarPorNombre(nombre)}
                  catalogo={catalogoEnMemoria}
                  onGuardarEnLista={(nombre, marca, precio, imagen) =>
                    guardarEnListaCompras({
                      perfume: nombre,
                      marca,
                      tienda: 'Referencia Chile',
                      precioGuardado: precio,
                      ml: null,
                      url: '',
                      imagen: imagen || null,
                      notaPersonal: t('Elegido con el recomendador'),
                    })
                  }
                />

                {/* Para ti: recomendaciones según la lista, las búsquedas y las alergias del usuario */}
                {recomendacionesParaTi.length > 0 && (
                  <section aria-labelledby="titulo-para-ti" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      <h3 id="titulo-para-ti" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--m3-text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={16} style={{ color: 'var(--m3-primary)' }} /> {t('Para ti')}
                      </h3>
                      <span style={{ fontSize: '12px', color: 'var(--m3-text-secondary)' }}>
                        {totalAlergiasConfiguradas > 0 ? t('Según tus favoritos y tus búsquedas recientes, sin tus alérgenos en sus notas') : t('Según tus favoritos y tus búsquedas recientes')}
                      </span>
                    </div>
                    <div className="knasta-related-grid">
                      {recomendacionesParaTi.map(({ item, motivo }) => (
                        <article
                          key={item.id}
                          className="knasta-card"
                          role="button"
                          tabIndex={0}
                          aria-label={t('Ver {nombre}', { nombre: `${item.marca} ${item.nombre}` })}
                          onClick={() => inspeccionarPerfumeDelCatalogo(item, catalogoEnMemoria)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              inspeccionarPerfumeDelCatalogo(item, catalogoEnMemoria);
                            }
                          }}
                          style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                        >
                          <div className="knasta-img-stage" style={{ height: '150px', padding: '12px' }}>
                            {item.imagen ? (
                              <img src={item.imagen} alt={item.nombre} style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain' }} loading="lazy" />
                            ) : (
                              <BottlePlaceholder size={64} />
                            )}
                          </div>
                          <div className="knasta-card-body" style={{ padding: '10px 12px' }}>
                            <span className="knasta-brand-text" style={{ fontSize: '10.5px' }}>{item.marca}</span>
                            <h4 className="knasta-product-title" style={{ fontSize: '12.5px' }}>{item.nombre}</h4>
                            <strong style={{ display: 'block', fontSize: '1.05rem', color: 'var(--m3-text-primary)', marginTop: '4px' }}>
                              $ {item.precioReferencia.toLocaleString('es-CL')}
                            </strong>
                            <div style={{ fontSize: '10.5px', color: 'var(--m3-text-secondary)', marginTop: '2px' }}>{motivo}</div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {/* 1. Búsquedas Recientes */}
                {busquedasRecientes.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={12} /> {t('Búsquedas Recientes')}
                      </span>
                      <button
                        onClick={borrarRecientes}
                        style={{ border: 'none', background: 'transparent', color: 'var(--m3-text-tertiary)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {t('Limpiar historial')}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {busquedasRecientes.map(q => (
                        <button
                          key={q}
                          onClick={() => buscarPorNombre(q)}
                          className="m3-chip"
                        >
                          <Search size={12} /> {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Explorador de Catálogo con Sidebar de Filtros, Paginación 30 en 30 e Inspector Instantáneo */}
                <CatalogoFiltrosSidebar
                  alergiasUsuario={alergiasUsuario}
                  notasPersonalizadas={notasAlergiaCustom}
                  estaEnLista={(item) => estaEnLista({ perfume: item.nombre, url: item.urlMejorPrecio || '', ml: item.ml })}
                  onCotizarEnVivo={(nombre) => buscarPorNombre(nombre)}
                  onInspeccionarPerfume={inspeccionarPerfumeDelCatalogo}
                  onCatalogoActualizado={setCatalogoEnMemoria}
                  onGuardarEnLista={(item) =>
                    guardarEnListaCompras({
                      perfume: item.nombre,
                      marca: item.marca,
                      tienda: item.tiendaMejorPrecio || t('Catálogo Chile'),
                      precioGuardado: item.precioReferencia,
                      ml: item.ml,
                      concentracion: item.concentracion,
                      url: item.urlMejorPrecio || '',
                      imagen: item.imagen,
                      notaPersonal: `${item.familia} · ${item.concentracion}`,
                    }, { alternar: true, precioVerificado: item.fechaPrecio === new Date().toISOString().split('T')[0] })
                  }
                  onComparar={(nombre, item) => abrirComparador(nombre, item ? ofertaDeCatalogo(item) : null)}
                />
            </div>
          </div>
        )}

        {/* VISTA 2: COMPARADOR FRENTE A FRENTE */}
        {vistaPrincipal === 'comparar' && (
          <ComparadorLadoALado
            p1Inicial={compP1}
            p2Inicial={compP2}
            ofertaA={compOferta1}
            ofertaB={compOferta2}
            onOfertaElegida={(lado, oferta) => (lado === 'a' ? setCompOferta1 : setCompOferta2)(oferta)}
            alergiasIds={alergiasUsuario}
            notasCustom={notasAlergiaCustom}
            listaCompras={listaCompras}
            recientes={busquedasRecientes}
            catalogo={catalogoEnMemoria}
            estaEnLista={estaEnLista}
            onAbrirAlergias={() => setMostrarModalAlergias(true)}
            onGuardarEnLista={guardarEnListaCompras}
            onExplorarPerfume={(nombre) => buscarPorNombre(nombre)}
            onRegistrarLogCliente={registrarLogCliente}
            onComparado={(a, b) => {
              // Otro perfume en un lado: la oferta que se traía ya no es de ese lado
              if (a !== compP1) setCompOferta1(null);
              if (b !== compP2) setCompOferta2(null);
              setCompP1(a);
              setCompP2(b);
            }}
          />
        )}
      </main>

      {/* Los logs son para revisar la app, no para quien compra: quedan en el pie, discretos */}
      <footer style={{ display: 'flex', justifyContent: 'center', padding: '20px 16px 28px' }}>
        <button
          type="button"
          onClick={() => setMostrarModalLogs(true)}
          title={t('Consola de logs y telemetría')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', color: 'var(--m3-text-secondary)' }}
        >
          <Terminal size={13} /> {t('Registro técnico')}
          {ultimaLatencia && (
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              · {t('última búsqueda')} {ultimaLatencia.cache ? `${ultimaLatencia.ms} ms` : `${(ultimaLatencia.ms / 1000).toFixed(1)} s`}
            </span>
          )}
        </button>
      </footer>

      {/* Modal Informativo: Rango y Cobertura de Búsqueda */}
      <ModalRangoBusqueda
        abierto={mostrarModalRango}
        alCerrar={() => setMostrarModalRango(false)}
      />

      {/* Modal Semana 5: Perfil de Alergias e Intolerancias IFRA */}
      <ModalPerfilAlergias
        abierto={mostrarModalAlergias}
        alCerrar={() => setMostrarModalAlergias(false)}
        alergiasSeleccionadas={alergiasUsuario}
        onToggleAlergia={toggleAlergiaId}
        notasPersonalizadas={notasAlergiaCustom}
        onAgregarNotaPersonalizada={agregarNotaAlergiaCustom}
        onEliminarNotaPersonalizada={eliminarNotaAlergiaCustom}
        onLimpiarTodo={() => {
          setAlergiasUsuario([]);
          setNotasAlergiaCustom([]);
          try {
            localStorage.removeItem('perfumescan_alergias_ids');
            localStorage.removeItem('perfumescan_alergias_custom');
          } catch {}
        }}
      />

      {/* Modal Semana 5: Lista de Compras y Favoritos */}
      <ModalCuenta
        abierto={mostrarModalCuenta}
        alCerrar={() => setMostrarModalCuenta(false)}
        usuario={usuarioCuenta}
        cantidadLista={listaCompras.length}
        bajaronDePrecio={bajaronDePrecio}
        cantidadAlergias={totalAlergiasConfiguradas}
        onAbrirLista={() => { setMostrarModalCuenta(false); setMostrarModalLista(true); }}
        onAbrirAlergias={() => { setMostrarModalCuenta(false); setMostrarModalAlergias(true); }}
        onEnviar={enviarCuenta}
        onCambiarContrasena={cambiarContrasenaCuenta}
        onBorrarCuenta={borrarCuenta}
        onSalir={salirDeCuenta}
      />

      <ModalListaCompras
        abierto={mostrarModalLista}
        alCerrar={() => setMostrarModalLista(false)}
        items={listaCompras.map(i => (i.concentracion ? i : { ...i, concentracion: extraerConcentracion(i.perfume) ?? undefined }))}
        listasPropias={listasPropias}
        onCrearLista={crearListaPropia}
        onRenombrarLista={renombrarListaPropia}
        onBorrarLista={borrarListaPropia}
        onAlternarEnLista={alternarEnListaPropia}
        onEliminar={eliminarDeListaCompras}
        onEliminarVarios={eliminarVariosDeLista}
        onQuitarDeLista={quitarDeListaPropia}
        onAgregarALista={agregarAListaPropia}
        onCambiarNota={cambiarNotaLista}
        onActualizarPrecios={() => actualizarPreciosLista(true)}
        actualizando={actualizandoLista}
        onBuscarEnVivo={(nombre, url) => buscarPorNombre(nombre, false, url || undefined)}
        onCompararDos={(p1, p2) => {
          // La lista guarda el título de la tienda y la página del producto: se busca por el nombre limpio y se abre
          // ese mismo producto y tamaño
          const lado = (nombre: string) => {
            const item = listaCompras.find((i) => i.perfume === nombre);
            if (!item) return { nombre, oferta: null };
            const oferta: PrecioMercado | null = item.url
              ? {
                  tienda: item.tienda,
                  nombre: item.ml && !/\d\s*ml/i.test(item.perfume) ? `${item.perfume} ${item.ml}ml` : item.perfume,
                  precio: item.precioActual ?? item.precioGuardado,
                  moneda: 'CLP',
                  stock: 'Sin verificar',
                  url: item.url,
                  imagen: item.imagen,
                }
              : null;
            return { nombre: terminoDeBusqueda(item.perfume, item.marca), oferta };
          };
          const a = lado(p1);
          const b = lado(p2);
          abrirComparador(a.nombre, a.oferta, b.nombre, b.oferta);
        }}
        onVaciarLista={() => {
          setListaCompras([]);
          try { localStorage.removeItem('perfumescan_lista_compras'); } catch {}
        }}
      />

      {/* Modal Semana 5: Consola de Logs y Telemetría */}
      <ConsolaLogsModal
        abierto={mostrarModalLogs}
        alCerrar={() => setMostrarModalLogs(false)}
        apiBase={API_BASE}
        logsCliente={logsCliente}
        onLimpiarLogsCliente={() => setLogsCliente([])}
      />

      {menuGuardado && (() => {
        const item = listaCompras.find(i => mismoGuardado(i, menuGuardado.nuevo));
        if (!item) return null;
        return (
          <MenuGuardado
            x={menuGuardado.x}
            y={menuGuardado.y}
            perfume={item.perfume}
            recienGuardado={menuGuardado.recien}
            listas={listasPropias}
            enListas={item.listas || []}
            onAlternarLista={(listaId) => alternarEnListaPropia(item.id, listaId)}
            onCrearLista={crearListaPropia}
            onQuitar={() => {
              eliminarDeListaCompras(item.id);
              setMenuGuardado(null);
              dispararToast(t('Quitado de Favoritos: {p}', { p: item.perfume }));
            }}
            onCerrar={() => setMenuGuardado(null)}
          />
        );
      })()}

      {/* Toast Flotante de Confirmación */}
      {toastMensaje && (
        <div className="m3-toast">
          <Check size={16} style={{ color: '#4ade80' }} />
          <span>{toastMensaje}</span>
        </div>
      )}
    </div>
  );
}
