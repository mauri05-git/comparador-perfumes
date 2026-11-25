// Comparador frente a frente: dos perfumes con sus ofertas, veredictos de precio, duración y piel, radar y notas.
import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { Search, Scale, ShieldCheck, Store, Droplets, Heart, ExternalLink, Award, Clock, AlertCircle, ArrowLeftRight, Zap } from 'lucide-react';
import { RadarOlfativoChart } from './RadarOlfativoChart';
import { LecturaRadar } from './LecturaRadar';
import { BannerSemaforoAlergia, evaluarRiesgoAlergia } from './SistemaAlergias';
import { type ItemListaCompra } from './ListaComprasDrawer';
import { type EntradaLogSistema } from './ConsolaLogsModal';
import { esMismoPerfume, nombreSegunOferta, terminoDeBusqueda } from '../nombres';
import { CampoPerfume } from './CampoPerfume';
import { veredictoPiel, type LadoPiel } from '../veredictoPiel';
import { t, tn, tServidor } from '../i18n.ts';
import { fichaParaMostrar } from '../fichaIdioma.ts';
import { type FichaFragancia, type PerfumeComparado, type PrecioMercado } from '../tipos.ts';
import { buscarImagenRespaldoCatalogo, gruposDePerfumes, type ConFoto } from '../sugerencias.ts';
import { API_BASE } from '../api.ts';
import { calcularPrecioPorMl, compararPrecios, extraerConcentracion, fichaConAlergenosDeOferta, mismaOferta, mlDeOferta, normalizarImagen, obtenerRadarDeFicha, otroPerfumeDeOferta, tituloConConcentracion } from '../ofertas.ts';
import { FuenteFicha } from './FichaFragancia.tsx';

// Disponibles primero; entre ellas, las del perfume de la ficha antes que otras versiones; después, por precio
function ordenarOfertasComparador(precios: PrecioMercado[], ficha?: FichaFragancia | null): PrecioMercado[] {
  const esOtro = (p: PrecioMercado) => (ficha && !esMismoPerfume(ficha.nombre, p.nombre, ficha.marca, ficha.genero) ? 1 : 0);
  return [...(precios || [])].sort((a, b) => {
    const agotadoA = a.stock === 'Agotado' ? 1 : 0;
    const agotadoB = b.stock === 'Agotado' ? 1 : 0;
    if (agotadoA !== agotadoB) return agotadoA - agotadoB;
    if (esOtro(a) !== esOtro(b)) return esOtro(a) - esOtro(b);
    const pa = typeof a.precio === 'number' && a.precio > 0 ? a.precio : Infinity;
    const pb = typeof b.precio === 'number' && b.precio > 0 ? b.precio : Infinity;
    return pa - pb;
  });
}

export function ComparadorLadoALado({
  p1Inicial = '',
  p2Inicial = '',
  alergiasIds,
  notasCustom,
  listaCompras,
  recientes,
  catalogo = [],
  estaEnLista,
  onAbrirAlergias,
  onGuardarEnLista,
  onExplorarPerfume,
  onRegistrarLogCliente,
  onComparado,
  ofertaA,
  ofertaB,
  onOfertaElegida,
}: {
  p1Inicial?: string;
  p2Inicial?: string;
  // La oferta que se venía viendo de cada perfume: se abre esa en vez de la más barata
  ofertaA?: PrecioMercado | null;
  ofertaB?: PrecioMercado | null;
  onOfertaElegida?: (lado: 'a' | 'b', oferta: PrecioMercado) => void;
  alergiasIds: string[];
  notasCustom: string[];
  listaCompras: ItemListaCompra[];
  recientes: string[];
  catalogo?: ConFoto[];
  onAbrirAlergias: () => void;
  onGuardarEnLista: (item: Omit<ItemListaCompra, 'id' | 'fechaGuardado'>, opciones?: { alternar?: boolean }) => void;
  estaEnLista?: (x: { perfume: string; url: string; ml?: number | null }) => boolean;
  onExplorarPerfume: (nombre: string) => void;
  onRegistrarLogCliente: (nivel: EntradaLogSistema['nivel'], modulo: string, mensaje: string, duracion?: number) => void;
  onComparado?: (p1: string, p2: string) => void;
}) {
  const [perfume1, setPerfume1] = useState(p1Inicial);
  // Lo último comparado: si la app devuelve los mismos nombres (al poner la dirección) no se vuelve a consultar
  const ultimaComparadaRef = useRef('');
  const slotBRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (p1Inicial && !p2Inicial) slotBRef.current?.querySelector('input')?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [perfume2, setPerfume2] = useState(p2Inicial);
  const [cargando, setCargando] = useState(false);
  const [resultadoBase, setResultado] = useState<{ p1: PerfumeComparado; p2: PerfumeComparado } | null>(null);
  // Fichas pedidas para ofertas sin ficha propia, por término de búsqueda: null = no existe; sin la clave = falta pedirla
  const [fichasDeOfertas, setFichasDeOfertas] = useState<Record<string, FichaFragancia | null>>({});
  const fichasPedidasRef = useRef(new Set<string>());
  const [error, setError] = useState('');
  const [p1Idx, setP1Idx] = useState<number>(0);
  const [p2Idx, setP2Idx] = useState<number>(0);

  const SUGERENCIAS = [
    { p1: 'Acqua Di Gio', p2: 'Sauvage Dior', label: 'Acqua Di Gio vs Sauvage', tag: 'Clásico vs Bestia' },
    { p1: 'Versace Eros', p2: 'One Million Paco Rabanne', label: 'Versace Eros vs 1 Million', tag: 'Duelo Nocturno' },
    { p1: 'Bleu de Chanel', p2: 'Dylan Blue Versace', label: 'Bleu de Chanel vs Dylan Blue', tag: 'Azules de Oficina' },
    { p1: 'Dolce & Gabbana Light Blue', p2: 'Calvin Klein CK One', label: 'Light Blue vs CK One', tag: 'Frescos Verano' },
    { p1: 'Good Girl Carolina Herrera', p2: 'La Vie Est Belle Lancome', label: 'Good Girl vs La Vie Est Belle', tag: 'Íconos Gourmand' },
  ];

  const ejecutarComparacionParams = async (p1Raw: string, p2Raw: string) => {
    const p1 = p1Raw.trim();
    const p2 = p2Raw.trim();
    if (!p1 || !p2) {
      setError(t('Por favor ingresa los dos perfumes a comparar.'));
      return;
    }
    if (p1.toLowerCase() === p2.toLowerCase()) {
      setError(t('Selecciona dos perfumes distintos para contrastar sus precios y notas.'));
      return;
    }
    ultimaComparadaRef.current = `${p1}|${p2}`.toLowerCase();
    onComparado?.(p1, p2);
    const t0 = Date.now();
    setCargando(true);
    setError('');
    setResultado(null);
    setP1Idx(0);
    setP2Idx(0);

    try {
      const resp = await fetch(
        `${API_BASE}/api/comparar?p1=${encodeURIComponent(p1)}&p2=${encodeURIComponent(p2)}`
      );
      const data = await resp.json();
      const dur = Date.now() - t0;
      if (data.success && data.p1 && data.p2) {
        // La oferta pedida vale solo para el perfume con que se abrió el comparador (no si después se escribió otro)
        const pedida = (p: string, inicial: string | undefined, oferta: PrecioMercado | null | undefined) =>
          oferta?.url && p.toLowerCase() === (inicial || '').trim().toLowerCase() ? oferta : null;
        const pedida1 = pedida(p1, p1Inicial, ofertaA);
        const pedida2 = pedida(p2, p2Inicial, ofertaB);
        // Si la búsqueda por nombre no trajo la oferta que se venía viendo, se agrega con los datos que ya se tenían
        // (una conocida solo por su URL no tiene datos que mostrar)
        const conPedida = (precios: PrecioMercado[], o: PrecioMercado | null) =>
          !o?.nombre || precios.some((x) => mismaOferta(x, o)) ? precios : [o, ...precios];
        const precios1 = conPedida(ordenarOfertasComparador(data.p1.precios || [], data.p1.ficha), pedida1);
        const precios2 = conPedida(ordenarOfertasComparador(data.p2.precios || [], data.p2.ficha), pedida2);
        const esComprable = (x: PrecioMercado) => typeof x.precio === 'number' && x.precio > 0 && x.stock !== 'Agotado';
        const mejor1 = precios1.find(esComprable)?.precio ?? data.p1.mejorPrecio ?? null;
        const mejor2 = precios2.find(esComprable)?.precio ?? data.p2.mejorPrecio ?? null;

        setResultado({
          p1: { ...data.p1, precios: precios1, mejorPrecio: mejor1 },
          p2: { ...data.p2, precios: precios2, mejorPrecio: mejor2 },
        });
        // Comparar también agrega los perfumes al catálogo
        window.dispatchEvent(new Event('catalogo-actualizado'));
        // Se parte con la oferta más barata del perfume buscado, no con la de otra versión que trajo la búsqueda
        // Si se pidió una oferta, esa misma
        // Sin ficha, la del nombre buscado: si no, abría la más barata aunque fuera otra versión ("Le Parfum" por "Over Red")
        const idxPropio = (precios: PrecioMercado[], f: FichaFragancia | null, o: PrecioMercado | null, buscado: string) => {
          const iPedida = o ? precios.findIndex((x) => mismaOferta(x, o)) : -1;
          if (iPedida >= 0) return iPedida;
          return Math.max(0, precios.findIndex(x => f ? esMismoPerfume(f.nombre, x.nombre, f.marca, f.genero) : esMismoPerfume(buscado, x.nombre)));
        };
        setP1Idx(idxPropio(precios1, data.p1.ficha, pedida1, p1));
        setP2Idx(idxPropio(precios2, data.p2.ficha, pedida2, p2));
        onRegistrarLogCliente(
          data.desde_cache ? 'CACHE' : 'SUCCESS',
          'COMPARADOR',
          `Comparación "${p1}" vs "${p2}" lista (${data.desde_cache ? 'desde caché' : 'en vivo'})`,
          dur
        );
      } else {
        setError(tServidor(data.mensaje) || t('Error al realizar la comparación'));
      }
    } catch {
      setError(t('Error de conexión con el servidor. Verifica que el backend esté activo en el puerto 8000.'));
      onRegistrarLogCliente('ERROR', 'COMPARADOR', `Fallo de red al comparar "${p1}" vs "${p2}"`);
    } finally {
      setCargando(false);
    }
  };

  const invertirPerfumes = () => {
    const temp1 = perfume1;
    setPerfume1(perfume2);
    setPerfume2(temp1);
    if (resultadoBase) {
      // La dirección también se invierte, sin volver a consultar (los nombres ya se compararon)
      ultimaComparadaRef.current = `${perfume2.trim()}|${perfume1.trim()}`.toLowerCase();
      onComparado?.(perfume2.trim(), perfume1.trim());
      setResultado({ p1: resultadoBase.p2, p2: resultadoBase.p1 });
      const idxTemp = p1Idx;
      setP1Idx(p2Idx);
      setP2Idx(idxTemp);
    }
  };

  useEffect(() => {
    if (p1Inicial) setPerfume1(p1Inicial);
    if (p2Inicial) setPerfume2(p2Inicial);
    if (p1Inicial && p2Inicial && `${p1Inicial.trim()}|${p2Inicial.trim()}`.toLowerCase() !== ultimaComparadaRef.current) {
      ejecutarComparacionParams(p1Inicial, p2Inicial);
    }
  }, [p1Inicial, p2Inicial]);

  // Término con que se pide la ficha de la oferta elegida cuando el lado no tiene una que le corresponda: la oferta es
  // otro perfume que el buscado ("Angel Nova Fruitee" al comparar "A*Men") o el perfume quedó sin ficha
  const terminoFichaDeOferta = (d: PerfumeComparado, o: PrecioMercado | undefined): string | null => {
    if (!o?.nombre || (d.ficha && !otroPerfumeDeOferta(d.ficha, o))) return null;
    const marca = d.ficha?.marca;
    return terminoDeBusqueda(d.ficha ? nombreSegunOferta(d.ficha.nombre, o.nombre, marca) : o.nombre, marca);
  };
  // Cada lado usa la ficha pedida para su oferta apenas llega. Si no es de ese perfume (la IA describió otra versión),
  // fichaDeOferta la descarta igual que a la del perfume buscado.
  const conFichaDeOferta = (d: PerfumeComparado, o: PrecioMercado | undefined): PerfumeComparado => {
    const termino = terminoFichaDeOferta(d, o);
    const f = termino ? fichasDeOfertas[termino] : null;
    return f ? { ...d, ficha: f } : d;
  };
  const resultado = resultadoBase && {
    p1: conFichaDeOferta(resultadoBase.p1, resultadoBase.p1.precios[p1Idx]),
    p2: conFichaDeOferta(resultadoBase.p2, resultadoBase.p2.precios[p2Idx]),
  };
  // La ficha se pide una sola vez por perfume; el backend la guarda y la próxima vez sale al tiro
  useEffect(() => {
    if (!resultadoBase) return;
    const lados = [[resultadoBase.p1, resultadoBase.p1.precios[p1Idx]], [resultadoBase.p2, resultadoBase.p2.precios[p2Idx]]] as const;
    for (const [d, o] of lados) {
      const termino = terminoFichaDeOferta(d, o);
      if (!termino || fichasPedidasRef.current.has(termino)) continue;
      fichasPedidasRef.current.add(termino);
      const ofertas = d.precios.filter((p) => terminoFichaDeOferta(d, p) === termino).slice(0, 5);
      const t0 = Date.now();
      fetch(`${API_BASE}/api/ficha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: termino, ofertas }),
      })
        .then((r) => r.json())
        .then((data) => {
          setFichasDeOfertas((prev) => ({ ...prev, [termino]: data?.ficha ?? null }));
          onRegistrarLogCliente(data?.ficha ? 'SUCCESS' : 'WARN', 'COMPARADOR', `Ficha de "${termino}": ${data?.ficha ? 'lista' : 'no existe'}`, Date.now() - t0);
        })
        .catch(() => {
          // Sin conexión no se da por inexistente: se vuelve a pedir al elegir de nuevo esa oferta
          fichasPedidasRef.current.delete(termino);
          setFichasDeOfertas((prev) => ({ ...prev, [termino]: null }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultadoBase, p1Idx, p2Idx]);
  const fichaPendiente = (d: PerfumeComparado | undefined, o: PrecioMercado | undefined) => {
    const termino = d ? terminoFichaDeOferta(d, o) : null;
    return !!termino && !(termino in fichasDeOfertas);
  };
  const pendienteP1 = fichaPendiente(resultadoBase?.p1, resultadoBase?.p1.precios[p1Idx]);
  const pendienteP2 = fichaPendiente(resultadoBase?.p2, resultadoBase?.p2.precios[p2Idx]);

  const ofertaActivaP1 = resultado?.p1.precios[p1Idx];
  const ofertaActivaP2 = resultado?.p2.precios[p2Idx];
  // La oferta elegida queda en la dirección: un link compartido o recargar abren la misma
  useEffect(() => {
    if (ofertaActivaP1?.url) onOfertaElegida?.('a', ofertaActivaP1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofertaActivaP1?.url, ofertaActivaP1?.nombre]);
  useEffect(() => {
    if (ofertaActivaP2?.url) onOfertaElegida?.('b', ofertaActivaP2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofertaActivaP2?.url, ofertaActivaP2?.nombre]);
  // La ficha describe al perfume buscado. Si la oferta elegida es otra versión ("Profondo", un set), la duración,
  // las notas y el perfil no le corresponden: ese lado queda sin esos datos en vez de mostrar los de otro perfume.
  const fichaDeOferta = (d: PerfumeComparado | undefined, o: PrecioMercado | undefined) =>
    d?.ficha && !otroPerfumeDeOferta(d.ficha, o) ? d.ficha : null;
  const fichaP1 = fichaDeOferta(resultado?.p1, ofertaActivaP1);
  const fichaP2 = fichaDeOferta(resultado?.p2, ofertaActivaP2);

  const precioP1 = ofertaActivaP1?.precio ?? resultado?.p1.mejorPrecio ?? null;
  const precioP2 = ofertaActivaP2?.precio ?? resultado?.p2.mejorPrecio ?? null;

  // Sin tamaño conocido no se asume ninguno: el precio por ml quedaría inventado
  const mlP1 = mlDeOferta(ofertaActivaP1);
  const mlP2 = mlDeOferta(ofertaActivaP2);

  const costoPorMlP1 = precioP1 && mlP1 ? Math.round(precioP1 / mlP1) : null;
  const costoPorMlP2 = precioP2 && mlP2 ? Math.round(precioP2 / mlP2) : null;

  const veredicto = compararPrecios(precioP1, mlP1, precioP2, mlP2);
  const ganadorPrecio = veredicto.ganador;

  // Si los frascos elegidos tienen distinto tamaño pero ambos perfumes se venden en uno común, se ofrece
  // compararlos así (la más barata disponible de ese tamaño en cada lado). Solo cuenta el mismo perfume de la oferta
  // elegida: cambiar "Angel Nova Fruitee 25 ml" por "Angel Elixir 100 ml" sería comparar otro perfume.
  const mismoTamano = (() => {
    if (!resultado || (mlP1 && mlP1 === mlP2)) return null;
    const indicePorMl = (d: PerfumeComparado, activa: PrecioMercado | undefined) => {
      const precios = d.precios;
      // Mismo nombre y misma concentración: Sauvage EDT y Sauvage EDP también son frascos distintos
      const clave = (o: PrecioMercado | undefined) =>
        `${nombreSegunOferta(d.ficha?.nombre || d.nombre, o?.nombre, d.ficha?.marca)}|${extraerConcentracion(o?.nombre || '') ?? ''}`.toLowerCase();
      const claveActiva = clave(activa);
      const mapa = new Map<number, number>();
      precios.forEach((p, i) => {
        const ml = mlDeOferta(p);
        if (!ml || !p.precio || p.stock === 'Agotado' || clave(p) !== claveActiva) return;
        const previo = mapa.get(ml);
        if (previo === undefined || (precios[previo].precio ?? Infinity) > p.precio) mapa.set(ml, i);
      });
      return mapa;
    };
    const a = indicePorMl(resultado.p1, ofertaActivaP1);
    const b = indicePorMl(resultado.p2, ofertaActivaP2);
    const comunes = [mlP1, mlP2, ...a.keys()].filter((ml): ml is number => !!ml && a.has(ml) && b.has(ml));
    return comunes.length ? { ml: comunes[0], i1: a.get(comunes[0])!, i2: b.get(comunes[0])! } : null;
  })();

  const durP1 = fichaP1?.duracion_horas ?? null;
  const durP2 = fichaP2?.duracion_horas ?? null;
  const ganadorRendimiento: 'p1' | 'p2' | 'empate' | 'sin_datos' =
    durP1 === null || durP2 === null ? 'sin_datos' : durP1 > durP2 ? 'p1' : durP2 > durP1 ? 'p2' : 'empate';

  const fichaAlergiasP1 = fichaConAlergenosDeOferta(resultado?.p1.ficha, ofertaActivaP1);
  const fichaAlergiasP2 = fichaConAlergenosDeOferta(resultado?.p2.ficha, ofertaActivaP2);
  const evalAlergiaP1 = fichaAlergiasP1 ? evaluarRiesgoAlergia(fichaAlergiasP1, alergiasIds, notasCustom) : null;
  const evalAlergiaP2 = fichaAlergiasP2 ? evaluarRiesgoAlergia(fichaAlergiasP2, alergiasIds, notasCustom) : null;


  // Mismo nombre que muestran las tarjetas, para que los veredictos hablen de las ofertas elegidas
  const nombreDeOferta = (d: PerfumeComparado | undefined, o: PrecioMercado | undefined) =>
    d ? tituloConConcentracion(d.ficha ? nombreSegunOferta(d.ficha.nombre, o?.nombre, d.ficha.marca) : d.nombre, o?.nombre || '') : '';
  const nombreA = nombreDeOferta(resultado?.p1, ofertaActivaP1);
  const nombreB = nombreDeOferta(resultado?.p2, ofertaActivaP2);
  const ladoPiel = (nombre: string, ficha: FichaFragancia | null, ev: typeof evalAlergiaP1): LadoPiel => ({
    nombre,
    declara: ficha?.alergenos_fuente === 'ingredientes',
    choques: (ev?.coincidencias || []).map((c) => c.nombre.split(' (')[0]),
    total: ev?.todosLosAlergenosDelPerfume.length ?? 0,
  });
  const piel = veredictoPiel(
    ladoPiel(nombreA, fichaAlergiasP1, evalAlergiaP1),
    ladoPiel(nombreB, fichaAlergiasP2, evalAlergiaP2),
    alergiasIds.length + notasCustom.length > 0,
  );

  // Notas en común entre ambos perfumes
  const todasNotasP1 = [
    ...(fichaP1?.notas_salida || []),
    ...(fichaP1?.notas_corazon || []),
    ...(fichaP1?.notas_fondo || []),
  ];
  const todasNotasP2 = [
    ...(fichaP2?.notas_salida || []),
    ...(fichaP2?.notas_corazon || []),
    ...(fichaP2?.notas_fondo || []),
  ];
  const notasEnComun = Array.from(
    new Set(
      todasNotasP1.filter(n1 =>
        todasNotasP2.some(
          n2 =>
            n1.toLowerCase().includes(n2.toLowerCase()) ||
            n2.toLowerCase().includes(n1.toLowerCase())
        )
      )
    )
  );

  // Al enfocar un campo se listan los guardados, las búsquedas recientes y los populares, para no tener que escribirlos
  const opcionesPerfume = gruposDePerfumes(listaCompras, recientes, true, catalogo);
  const estiloCampo: CSSProperties = {
    background: 'var(--m3-surface-container-low)', border: '1px solid var(--m3-outline)', borderRadius: '10px', padding: '9px 12px', fontSize: '13.5px',
  };

  const renderColumnaPerfume = (
    lado: 'p1' | 'p2',
    datos: PerfumeComparado,
    otroNombre: string,
    idxActivo: number,
    setIdxActivo: (n: number) => void,
    precioActual: number | null,
    mlActual: number | null,
    costoMlActual: number | null
  ) => {
    const esA = lado === 'p1';
    const colorTema = esA ? 'var(--m3-primary)' : 'var(--m3-secondary)';
    const oferta = datos.precios[idxActivo];
    const imgUrl =
      normalizarImagen(oferta?.imagen || datos.precios.find(p => p.imagen)?.imagen) ||
      buscarImagenRespaldoCatalogo(datos.nombre);
    const esGanadorPrecio = ganadorPrecio === lado;

    return (
      <div className={`m3-compare-column ${esGanadorPrecio ? 'winner' : ''}`}>
        {/* Cabecera de Opción A / B */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 800,
              color: colorTema,
              background: esA ? 'var(--m3-primary-container)' : 'var(--m3-secondary-container)',
              padding: '3px 10px',
              borderRadius: '99px',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}
          >
            {esA ? t('Perfume A') : t('Perfume B')}
          </span>

          {esGanadorPrecio && (
            <span
              style={{
                background: '#16a34a',
                color: '#fff',
                fontSize: '10.5px',
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: '99px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Award size={12} /> {t('Más barato')}
            </span>
          )}
        </div>

        {/* Imagen del Frasco */}
        {imgUrl && (
          <div className="m3-card-img-wrap" style={{ height: '150px', marginBottom: '12px' }}>
            <img
              src={imgUrl}
              alt={datos.nombre}
              className="m3-card-img"
              onError={e => {
                const padre = e.currentTarget.parentElement as HTMLElement;
                if (padre) padre.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Nombre, Marca y Precio Activo */}
        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
          {datos.ficha?.marca && (
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block' }}>
              {datos.ficha.marca}
            </span>
          )}
          <h4 className="m3-editorial-title" style={{ margin: '3px 0 6px 0', fontSize: '1.35rem', color: 'var(--m3-text-primary)', fontWeight: 700 }}>
            {tituloConConcentracion(datos.ficha ? nombreSegunOferta(datos.ficha.nombre, oferta?.nombre, datos.ficha.marca) : datos.nombre, oferta?.nombre || '')}
          </h4>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span className="m3-volume-badge">
              <Droplets size={11} /> {mlActual ? `${mlActual} ml` : t('Tamaño sin datos')}
            </span>
            {costoMlActual && (
              <span className="m3-price-per-ml">
                ${costoMlActual.toLocaleString('es-CL')}/ml
              </span>
            )}
          </div>

          {precioActual ? (
            <div style={{ marginTop: '8px' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: colorTema, fontFamily: 'var(--font-mono)', display: 'block' }}>
                ${precioActual.toLocaleString('es-CL')} CLP
              </span>
              {oferta?.tienda && (
                <span style={{ fontSize: '11.5px', color: 'var(--m3-text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <Store size={12} /> {oferta.tienda} ({tn(datos.precios.length, '{n} oferta en Chile', '{n} ofertas en Chile')})
                </span>
              )}
            </div>
          ) : (
            <div style={{ marginTop: '8px', padding: '7px 10px', background: 'var(--m3-surface-container)', borderRadius: '8px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--m3-text-tertiary)', fontWeight: 600 }}>
                {t('Sin stock verificado hoy en retail chileno')}
              </span>
            </div>
          )}

          {/* Botones de Acción Rápida: Ver en tienda, Guardar en Lista, Ficha Completa */}
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
            {oferta?.url && (
              <a
                href={oferta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="m3-btn m3-btn-primary"
                style={{ fontSize: '11.5px', padding: '6px 12px', textDecoration: 'none' }}
              >
                {t('Ir a {tienda}', { tienda: oferta.tienda })} <ExternalLink size={12} />
              </a>
            )}
            {(() => {
              // Igual que el corazón de las ofertas: muestra si está guardado y abre el menú de listas o quitar
              const guardado = !!estaEnLista?.({ perfume: oferta?.nombre || datos.nombre, url: oferta?.url || '', ml: mlActual });
              return (
                <button
                  type="button"
                  onClick={() =>
                    onGuardarEnLista({
                      perfume: oferta?.nombre || datos.nombre,
                      marca: datos.ficha?.marca,
                      tienda: oferta?.tienda || t('Referencia IA'),
                      precioGuardado: precioActual ?? null,
                      ml: mlActual,
                      url: oferta?.url || '',
                      imagen: imgUrl,
                      notaPersonal: t('Comparado con {otro}', { otro: otroNombre }),
                    }, { alternar: true })
                  }
                  className="m3-btn m3-btn-tonal"
                  aria-pressed={guardado}
                  title={guardado ? t('Está en Favoritos: elegir listas o quitar') : t('Guardar en Favoritos')}
                  style={{
                    fontSize: '11.5px', padding: '6px 12px',
                    ...(guardado ? { background: 'var(--m3-primary-container)', borderColor: '#ef4444', color: 'var(--m3-primary)' } : {}),
                  }}
                >
                  <Heart size={12} fill={guardado ? '#ef4444' : 'none'} color={guardado ? '#ef4444' : 'currentColor'} /> {guardado ? t('Guardado') : t('Guardar')}
                </button>
              );
            })()}
            <button
              type="button"
              onClick={() => {
                // Se busca el perfume de la oferta que se ve en la tarjeta, con la marca: "A*Men" solo se corregía a
                // "Ammen", y en una oferta de otra versión ("Angel Nova Fruitee") llevaba a un perfume distinto
                const marca = datos.ficha?.marca;
                const nombre = datos.ficha ? nombreSegunOferta(datos.ficha.nombre, oferta?.nombre, marca) : (oferta?.nombre || datos.nombre);
                onExplorarPerfume(terminoDeBusqueda(nombre, marca));
              }}
              className="m3-btn m3-btn-tonal"
              style={{ fontSize: '11.5px', padding: '6px 10px' }}
              title={t('Ver todas las tiendas y sucursales de este perfume')}
            >
              <Search size={12} /> {t('Ver todo')}
            </button>
          </div>
        </div>

        {/* Semáforo de Alergias IFRA */}
        {datos.ficha && (
          <BannerSemaforoAlergia
            ficha={fichaConAlergenosDeOferta(datos.ficha, oferta)}
            alergiasIds={alergiasIds}
            notasCustom={notasCustom}
            onAbrirConfig={onAbrirAlergias}
            compacto
          />
        )}

        {/* Selector Interactivo de Presentación / Tienda */}
        {datos.precios.length > 1 && (
          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
              {t('Cambiar oferta o tamaño ({n} disponibles):', { n: datos.precios.length })}
            </span>
            {(() => {
              // La primera es la del perfume buscado, no necesariamente la más barata
              const minimo = Math.min(...datos.precios.filter(x => x.stock !== 'Agotado' && typeof x.precio === 'number' && x.precio > 0).map(x => x.precio as number));
              const renderOferta = (p: PrecioMercado, i: number) => {
                const mlItem = mlDeOferta(p);
                const porMlItem = calcularPrecioPorMl(p.precio, mlItem);
                const activo = i === idxActivo;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdxActivo(i)}
                    className={`m3-offer-pill ${activo ? 'selected' : ''}`}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '11.5px', color: 'var(--m3-text-primary)' }}>{p.tienda}</strong>
                        {mlItem && (
                          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--m3-text-secondary)', fontWeight: 700 }}>
                            {mlItem}ml
                          </span>
                        )}
                        {p.precio === minimo && p.stock !== 'Agotado' && (
                          <span style={{ fontSize: '9.5px', background: 'rgba(22, 163, 74, 0.14)', color: '#15803d', padding: '1px 6px', borderRadius: '99px', fontWeight: 800 }}>
                            {t('Mínimo')}
                          </span>
                        )}
                        {p.stock === 'Agotado' && (
                          <span style={{ fontSize: '9.5px', background: 'rgba(220, 38, 38, 0.12)', color: '#dc2626', padding: '1px 6px', borderRadius: '99px', fontWeight: 800 }}>
                            {t('Agotado')}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--m3-text-tertiary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.nombre}
                      </span>
                    </div>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                      <strong style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: activo ? 'var(--m3-primary)' : 'var(--m3-text-primary)' }}>
                        {p.precio ? `$${p.precio.toLocaleString('es-CL')}` : 'S/P'}
                      </strong>
                      {porMlItem && (
                        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--m3-text-tertiary)' }}>{porMlItem}</span>
                      )}
                    </span>
                  </button>
                );
              };
              // Las 4 primeras a la vista y el resto plegado (antes las demás no se podían elegir)
              return (
                <>
                  <div className="m3-offer-pill-list">{datos.precios.slice(0, 4).map(renderOferta)}</div>
                  {datos.precios.length > 4 && (
                    <details open={idxActivo >= 4 || undefined} style={{ marginTop: '6px' }}>
                      <summary style={{ cursor: 'pointer', fontSize: '11.5px', fontWeight: 700, color: colorTema }}>
                        {t('Ver {n} ofertas más', { n: datos.precios.length - 4 })}
                      </summary>
                      <div className="m3-offer-pill-list" style={{ marginTop: '6px' }}>
                        {datos.precios.slice(4).map((p, j) => renderOferta(p, j + 4))}
                      </div>
                    </details>
                  )}
                </>
              );
            })()}
          </div>
        )}

      </div>
    );
  };

  // Notas y especificaciones de cada perfume, después de los veredictos (antes alargaban las tarjetas de precio)
  const renderNotasPerfume = (lado: 'p1' | 'p2', datos: PerfumeComparado) => {
    const colorTema = lado === 'p1' ? 'var(--m3-primary)' : 'var(--m3-secondary)';
    const ficha = fichaParaMostrar(lado === 'p1' ? fichaP1 : fichaP2);
    const nombre = lado === 'p1' ? nombreA : nombreB;
    if (datos.ficha && !ficha) {
      return (
        <div className="m3-compare-column">
          <strong style={{ display: 'block', fontSize: '13px', color: colorTema, marginBottom: '10px' }}>{nombre}</strong>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--m3-text-secondary)', lineHeight: 1.5 }}>
            {t('La oferta elegida es {nombre}, no {ficha}. Las notas y la duración de {ficha} no le corresponden, así que no se muestran. Elige arriba una oferta de {ficha} para verlas.', { nombre, ficha: datos.ficha.nombre })}
          </p>
        </div>
      );
    }
    return (
      <div className="m3-compare-column">
        <strong style={{ display: 'block', fontSize: '13px', color: colorTema, marginBottom: '10px' }}>{ficha?.nombre || datos.nombre}</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
          <div style={{ borderBottom: '1px solid var(--m3-outline-variant)', paddingBottom: '7px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', fontWeight: 800 }}>{t('Familia Olfativa')}</span>
            <strong style={{ color: 'var(--m3-text-primary)', textAlign: 'right' }}>{ficha?.familia_olfativa || t('Sin datos')}</strong>
          </div>

          <div style={{ borderBottom: '1px solid var(--m3-outline-variant)', paddingBottom: '7px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10.5px', color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', fontWeight: 800 }}>{t('Longevidad y Estela')}</span>
            <strong style={{ color: 'var(--m3-text-primary)' }}>
              {ficha?.duracion_horas ? `~${ficha.duracion_horas}h` : t('Sin datos')}
              {ficha?.proyeccion ? ` · ${t('Proyección {p}', { p: t(ficha.proyeccion) })}` : ''}
            </strong>
          </div>

          {/* Pirámide en 3 Capas */}
          <div style={{ background: 'var(--m3-surface-container-low)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--m3-outline-variant)' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: colorTema, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
              {t('Pirámide Olfativa')}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px' }}>
              <div>
                <strong style={{ color: 'var(--m3-text-primary)' }}>{t('Salida:')} </strong>
                <span style={{ color: 'var(--m3-text-secondary)' }}>
                  {ficha?.notas_salida?.join(', ') || t('Sin datos')}
                </span>
              </div>
              <div>
                <strong style={{ color: 'var(--m3-text-primary)' }}>{t('Corazón:')} </strong>
                <span style={{ color: 'var(--m3-text-secondary)' }}>
                  {ficha?.notas_corazon?.join(', ') || t('Sin datos')}
                </span>
              </div>
              <div>
                <strong style={{ color: 'var(--m3-text-primary)' }}>{t('Fondo:')} </strong>
                <span style={{ color: 'var(--m3-text-secondary)' }}>
                  {ficha?.notas_fondo?.join(', ') || t('Sin datos')}
                </span>
              </div>
            </div>
            {ficha && <FuenteFicha ficha={ficha} compacta />}
          </div>

          {/* Estaciones y Ocasiones */}
          {ficha?.estaciones && ficha.estaciones.length > 0 && (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '2px' }}>
              {ficha.estaciones.map((est, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '99px',
                    background: 'var(--m3-surface-container)',
                    color: 'var(--m3-text-secondary)',
                  }}
                >
                  {est}
                </span>
              ))}
              {(ficha.ocasiones || []).slice(0, 2).map((oc, i) => (
                <span
                  key={`oc-${i}`}
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '99px',
                    background: 'var(--m3-primary-container)',
                    color: 'var(--m3-primary)',
                  }}
                >
                  {oc}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="m3-compare-container">
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Comparador
        </span>
        <h3 className="m3-editorial-title" style={{ margin: '2px 0 6px 0', fontSize: '1.45rem', color: 'var(--m3-text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scale size={21} style={{ color: 'var(--m3-primary)' }} /> {t('Compara dos perfumes')}
        </h3>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--m3-text-secondary)' }}>
          {t('Precio en las 4 tiendas, precio por ml, duración, notas y alérgenos según tu perfil.')}
        </p>
      </div>

      {/* Duelos Clásicos a 1 Clic */}
      <div style={{ marginBottom: '14px' }}>
        <div className="m3-suggestions-bar">
          <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={12} style={{ color: 'var(--m3-primary)' }} /> {t('Comparaciones rápidas:')}
          </span>
          {SUGERENCIAS.map((s, i) => {
            const activo =
              perfume1.toLowerCase() === s.p1.toLowerCase() &&
              perfume2.toLowerCase() === s.p2.toLowerCase();
            return (
              <button
                key={i}
                type="button"
                className="m3-suggestion-chip"
                style={{
                  borderColor: activo ? 'var(--m3-primary)' : undefined,
                  background: activo ? 'var(--m3-primary-container)' : undefined,
                  color: activo ? 'var(--m3-primary)' : undefined,
                }}
                onClick={() => {
                  setPerfume1(s.p1);
                  setPerfume2(s.p2);
                  ejecutarComparacionParams(s.p1, s.p2);
                }}
              >
                <Scale size={12} />
                <span>{s.label}</span>
                <span style={{ fontSize: '10px', opacity: 0.75, fontWeight: 700 }}>· {t(s.tag)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Arena de Selección A vs B con Botón de Intercambio */}
      <div className="m3-compare-arena">
        {/* Slot A */}
        <div className="m3-compare-slot slot-a">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('Perfume A')}
            </label>
            {perfume1 && (
              <button
                type="button"
                onClick={() => setPerfume1('')}
                style={{ border: 'none', background: 'transparent', color: 'var(--m3-text-tertiary)', cursor: 'pointer', fontSize: '11px' }}
              >
                Limpiar
              </button>
            )}
          </div>
          <CampoPerfume
            className="m3-search-input"
            style={estiloCampo}
            placeholder={t('Elige de tus favoritos o escribe uno')}
            valor={perfume1}
            alCambiar={setPerfume1}
            alElegir={setPerfume1}
            alEnter={() => ejecutarComparacionParams(perfume1, perfume2)}
            grupos={opcionesPerfume}
          />
        </div>

        {/* Botón Central Invertir A ↔ B */}
        <button
          type="button"
          className="m3-vs-swap-btn"
          onClick={invertirPerfumes}
          title={t('Invertir orden de comparación (A ↔ B)')}
        >
          <ArrowLeftRight size={18} strokeWidth={2.2} />
        </button>

        {/* Slot B */}
        <div className="m3-compare-slot slot-b" ref={slotBRef}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--m3-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('Perfume B')}
            </label>
            {perfume2 && (
              <button
                type="button"
                onClick={() => setPerfume2('')}
                style={{ border: 'none', background: 'transparent', color: 'var(--m3-text-tertiary)', cursor: 'pointer', fontSize: '11px' }}
              >
                Limpiar
              </button>
            )}
          </div>
          <CampoPerfume
            className="m3-search-input"
            style={estiloCampo}
            placeholder={t('Elige de tus favoritos o escribe uno')}
            valor={perfume2}
            alCambiar={setPerfume2}
            alElegir={setPerfume2}
            alEnter={() => ejecutarComparacionParams(perfume1, perfume2)}
            grupos={opcionesPerfume}
          />
        </div>
      </div>

      <button
        onClick={() => ejecutarComparacionParams(perfume1, perfume2)}
        disabled={cargando || !perfume1.trim() || !perfume2.trim()}
        className="m3-btn m3-btn-primary"
        style={{ width: '100%', padding: '12px', fontSize: '0.95rem', borderRadius: 'var(--m3-shape-md)' }}
      >
        <Scale size={16} /> {cargando ? t('Buscando precios en las 4 tiendas...') : t('Comparar')}
      </button>

      {error && (
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.35)', color: '#dc2626', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {cargando && (
        <div className="m3-skeleton-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="m3-skeleton-card">
            <div className="m3-skeleton-box" style={{ height: '140px' }} />
            <div className="m3-skeleton-box" style={{ height: '24px', width: '70%' }} />
            <div className="m3-skeleton-box" style={{ height: '90px' }} />
          </div>
          <div className="m3-skeleton-card">
            <div className="m3-skeleton-box" style={{ height: '140px' }} />
            <div className="m3-skeleton-box" style={{ height: '24px', width: '70%' }} />
            <div className="m3-skeleton-box" style={{ height: '90px' }} />
          </div>
        </div>
      )}

      {/* Resultados del Duelo */}
      {resultado && (
        <div style={{ marginTop: '22px' }}>
          {/* 1. Las dos ofertas elegidas: al cambiar una, los veredictos de abajo se actualizan a la vista */}
          <div className="m3-compare-grid">
            {renderColumnaPerfume(
              'p1',
              resultado.p1,
              resultado.p2.nombre,
              p1Idx,
              setP1Idx,
              precioP1,
              mlP1,
              costoPorMlP1
            )}
            {renderColumnaPerfume(
              'p2',
              resultado.p2,
              resultado.p1.nombre,
              p2Idx,
              setP2Idx,
              precioP2,
              mlP2,
              costoPorMlP2
            )}
          </div>

          {/* 2. Veredictos: precio, duración y piel */}
          <div className="m3-verdict-podium" style={{ marginTop: '18px' }}>
            {/* Eje 1: Mejor Bolsillo / Ahorro */}
            <div className="m3-podium-card" style={{ borderColor: 'rgba(22, 163, 74, 0.4)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(22, 163, 74, 0.12)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Award size={19} />
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block' }}>
                  {t('Precio')}
                </span>
                <strong className="m3-editorial-title" style={{ fontSize: '14.5px', color: 'var(--m3-text-primary)', display: 'block', margin: '2px 0' }}>
                  {ganadorPrecio === 'p1'
                    ? t('{nombre} es más barato', { nombre: nombreA })
                    : ganadorPrecio === 'p2'
                    ? t('{nombre} es más barato', { nombre: nombreB })
                    : ganadorPrecio === 'empate'
                    ? t('Cuestan lo mismo')
                    : t('No se puede comparar el precio')}
                </strong>
                <span style={{ fontSize: '11.5px', color: 'var(--m3-text-secondary)' }}>
                  {veredicto.criterio === 'total'
                    ? t('Ahorras ${dif} ({pct}% menos) en el mismo tamaño ({ml} ml)', { dif: veredicto.diferencia.toLocaleString('es-CL'), pct: veredicto.porcentaje, ml: mlP1 ?? '' })
                    : veredicto.criterio === 'ml'
                    ? t('{pct}% más barato por ml: ${a}/ml ({mla} ml) vs ${b}/ml ({mlb} ml)', { pct: veredicto.porcentaje, a: costoPorMlP1?.toLocaleString('es-CL') ?? '', mla: mlP1 ?? '', b: costoPorMlP2?.toLocaleString('es-CL') ?? '', mlb: mlP2 ?? '' })
                    : !precioP1 || !precioP2
                    ? t('Falta el precio de una de las ofertas')
                    : t('Una de las ofertas no dice su tamaño: elige otra arriba')}
                </span>
                {mismoTamano && (
                  <button
                    type="button"
                    className="m3-btn m3-btn-tonal"
                    style={{ fontSize: '11.5px', padding: '4px 10px', marginTop: '6px' }}
                    onClick={() => { setP1Idx(mismoTamano.i1); setP2Idx(mismoTamano.i2); }}
                  >
                    <Scale size={12} /> {t('Comparar ambos en {ml} ml', { ml: mismoTamano.ml })}
                  </button>
                )}
              </div>
            </div>

            {/* Eje 2: Mejor Rendimiento / Fijación */}
            <div className="m3-podium-card" style={{ borderColor: 'var(--m3-primary)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--m3-primary-container)', color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={18} />
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--m3-primary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block' }}>
                  {t('Duración')}
                </span>
                <strong className="m3-editorial-title" style={{ fontSize: '14.5px', color: 'var(--m3-text-primary)', display: 'block', margin: '2px 0' }}>
                  {ganadorRendimiento === 'p1'
                    ? t('{nombre} dura más', { nombre: nombreA })
                    : ganadorRendimiento === 'p2'
                    ? t('{nombre} dura más', { nombre: nombreB })
                    : ganadorRendimiento === 'empate'
                    ? t('Duran lo mismo')
                    : t('Sin datos de duración')}
                </strong>
                <span style={{ fontSize: '11.5px', color: 'var(--m3-text-secondary)' }}>
                  {ganadorRendimiento === 'sin_datos' ? '' : `${t('~{a}h vs ~{b}h en la piel (referencial).', { a: durP1 ?? '', b: durP2 ?? '' })} `}
                  {t('Proyección {a} vs {b}', { a: fichaP1?.proyeccion ? t(fichaP1.proyeccion).toLowerCase() : t('sin datos'), b: fichaP2?.proyeccion ? t(fichaP2.proyeccion).toLowerCase() : t('sin datos') })}
                </span>
              </div>
            </div>

            {/* Eje 3: Seguridad Dermatológica IFRA */}
            <div className="m3-podium-card" style={{ borderColor: 'var(--m3-secondary)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--m3-secondary-container)', color: 'var(--m3-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldCheck size={19} />
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--m3-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block' }}>
                  {t('Para tu piel')}
                </span>
                <strong className="m3-editorial-title" style={{ fontSize: '14.5px', color: 'var(--m3-text-primary)', display: 'block', margin: '2px 0' }}>
                  {piel.titulo}
                </strong>
                <span style={{ fontSize: '11.5px', color: 'var(--m3-text-secondary)' }}>{piel.detalle}</span>
                {alergiasIds.length + notasCustom.length === 0 && (
                  <button
                    type="button"
                    className="m3-btn m3-btn-tonal"
                    style={{ fontSize: '11.5px', padding: '4px 10px', marginTop: '6px', display: 'flex' }}
                    onClick={onAbrirAlergias}
                  >
                    <ShieldCheck size={12} /> {t('Configurar mis alergias')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. Tabla lado a lado */}
          <div className="m3-compare-matrix">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h4 className="m3-editorial-title" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--m3-text-primary)' }}>
                {t('Lado a lado')}
              </h4>
              {notasEnComun.length > 0 && (
                <span style={{ fontSize: '11.5px', color: 'var(--m3-primary)', background: 'var(--m3-primary-container)', padding: '3px 10px', borderRadius: '99px', fontWeight: 700 }}>
                  {t('Notas en común: {notas}', { notas: notasEnComun.slice(0, 4).join(', ') })}
                </span>
              )}
            </div>

            {/* Fila 1: Mejor Precio */}
            <div className="m3-matrix-row">
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: veredicto.criterio === 'total' && ganadorPrecio === 'p1' ? '#16a34a' : 'var(--m3-text-primary)' }}>
                {precioP1 ? `$${precioP1.toLocaleString('es-CL')}` : t('Sin precio')}
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase' }}>
                Precio
              </div>
              <div style={{ textAlign: 'left', fontFamily: 'var(--font-mono)', fontWeight: 800, color: veredicto.criterio === 'total' && ganadorPrecio === 'p2' ? '#16a34a' : 'var(--m3-text-primary)' }}>
                {precioP2 ? `$${precioP2.toLocaleString('es-CL')}` : t('Sin precio')}
              </div>
            </div>

            {/* Fila 2: Costo por Mililitro */}
            <div className="m3-matrix-row">
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: costoPorMlP1 && costoPorMlP2 && costoPorMlP1 < costoPorMlP2 ? '#16a34a' : 'var(--m3-text-secondary)' }}>
                {costoPorMlP1 ? `$${costoPorMlP1.toLocaleString('es-CL')}/ml (${mlP1}ml)` : t('Tamaño sin datos')}
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase' }}>
                {t('Precio por ml')}
              </div>
              <div style={{ textAlign: 'left', fontFamily: 'var(--font-mono)', fontWeight: 700, color: costoPorMlP1 && costoPorMlP2 && costoPorMlP2 < costoPorMlP1 ? '#16a34a' : 'var(--m3-text-secondary)' }}>
                {costoPorMlP2 ? `$${costoPorMlP2.toLocaleString('es-CL')}/ml (${mlP2}ml)` : t('Tamaño sin datos')}
              </div>
            </div>

            {/* Fila 3: Fijación en Piel con barra visual */}
            <div className="m3-matrix-row">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '12.5px' }}>{durP1 !== null ? `~${durP1}h` : t('Sin datos')}</span>
                <div className="m3-matrix-bar" style={{ width: '70px', height: '7px', background: 'var(--m3-surface-container)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (durP1 ?? 0) * 9)}%`, height: '100%', background: 'var(--m3-primary)', borderRadius: '99px' }} />
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase' }}>
                {t('Duración en piel')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px' }}>
                <div className="m3-matrix-bar" style={{ width: '70px', height: '7px', background: 'var(--m3-surface-container)', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (durP2 ?? 0) * 9)}%`, height: '100%', background: 'var(--m3-secondary)', borderRadius: '99px' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '12.5px' }}>{durP2 !== null ? `~${durP2}h` : t('Sin datos')}</span>
              </div>
            </div>

            {/* Fila 4: Ofertas en Retail Chileno */}
            <div className="m3-matrix-row">
              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: 'var(--m3-text-secondary)' }}>
                {t('{n} ofertas ({c} cadenas)', { n: resultado.p1.precios.length, c: Array.from(new Set(resultado.p1.precios.map(p => p.tienda))).length })}
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'var(--m3-text-tertiary)', textTransform: 'uppercase' }}>
                {t('Ofertas en Chile')}
              </div>
              <div style={{ textAlign: 'left', fontWeight: 700, fontSize: '12.5px', color: 'var(--m3-text-secondary)' }}>
                {t('{n} ofertas ({c} cadenas)', { n: resultado.p2.precios.length, c: Array.from(new Set(resultado.p2.precios.map(p => p.tienda))).length })}
              </div>
            </div>
          </div>

          {/* 4. Radar superpuesto */}
          {fichaP1 && fichaP2 ? (
            <>
              <RadarOlfativoChart
                radar1={obtenerRadarDeFicha(fichaP1)}
                nombre1={nombreA}
                radar2={obtenerRadarDeFicha(fichaP2)}
                nombre2={nombreB}
              />
              <LecturaRadar radar1={obtenerRadarDeFicha(fichaP1)} radar2={obtenerRadarDeFicha(fichaP2)} nombre1={nombreA} nombre2={nombreB} />
            </>
          ) : (pendienteP1 && !fichaP1) || (pendienteP2 && !fichaP2) ? (
            <p style={{ margin: '18px 0', padding: '12px 16px', fontSize: '12.5px', color: 'var(--m3-text-secondary)', border: '1px dashed var(--m3-outline)', borderRadius: 'var(--m3-shape-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={14} style={{ flexShrink: 0 }} />
              {t('Preparando la ficha de {nombres}. La primera vez puede tardar hasta 20 segundos; después queda guardada.', { nombres: [pendienteP1 && !fichaP1 && nombreA, pendienteP2 && !fichaP2 && nombreB].filter(Boolean).join(t(' y ')) })}
            </p>
          ) : (
            <p style={{ margin: '18px 0', padding: '12px 16px', fontSize: '12.5px', color: 'var(--m3-text-secondary)', border: '1px dashed var(--m3-outline)', borderRadius: 'var(--m3-shape-md)' }}>
              {t('El perfil olfativo se compara cuando las dos ofertas elegidas tienen ficha. No hay ficha de {nombres}: la IA no conoce ese perfume y las tiendas no publican sus notas.', { nombres: [!fichaP1 && nombreA, !fichaP2 && nombreB].filter(Boolean).join(t(' y ')) })}
            </p>
          )}

          {/* 5. Notas de cada perfume */}
          <div className="m3-compare-grid">
            {renderNotasPerfume('p1', resultado.p1)}
            {renderNotasPerfume('p2', resultado.p2)}
          </div>
        </div>
      )}
    </div>
  );
}
