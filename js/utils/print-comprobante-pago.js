import { alertError } from './swal.js';
import { getPrintLogoUrl } from './empresa-logo.js';
import { getEmpresaPrintData, empresaContactHtml, empresaContactCss } from './empresa-print.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrecio(valor) {
  const num = Number(valor);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatFecha(fecha) {
  if (!fecha) return '—';
  const partes = String(fecha).split('T')[0].split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function getTipoComprobante(tipo) {
  if (tipo === 'ABONO') {
    return {
      tituloDocumento: 'Comprobante de abono',
      subtitulo: 'Recibo de abono',
      etiquetaMonto: 'Monto abonado',
      colorMonto: '#1d4ed8',
      tipoLabel: 'ABONO — Saldo a favor',
    };
  }

  return {
    tituloDocumento: 'Comprobante de pago',
    subtitulo: 'Recibo de pago',
    etiquetaMonto: 'Monto pagado',
    colorMonto: '#15803d',
    tipoLabel: 'PAGO — Salida',
  };
}

export function printComprobantePago(transaccion, { empresa } = {}) {
  try {
    const tipoInfo = getTipoComprobante(transaccion.TIPO);
    const empresaInfo = getEmpresaPrintData(empresa);
    const empresaNombre = escapeHtml(empresaInfo.nombre);
    const contactoHtml = empresaContactHtml(empresaInfo);
    const paciente = escapeHtml(transaccion.PACIENTE || `Paciente #${transaccion.CODPACIENTE || ''}`);
    const numero = escapeHtml(transaccion.ID || '—');
    const fecha = escapeHtml(formatFecha(transaccion.FECHA));
    const monto = escapeHtml(formatPrecio(transaccion.MONTO));
    const tipoComprobante = escapeHtml(tipoInfo.tipoLabel);
    const tituloDocumento = escapeHtml(tipoInfo.tituloDocumento);
    const subtitulo = escapeHtml(tipoInfo.subtitulo);
    const etiquetaMonto = escapeHtml(tipoInfo.etiquetaMonto);
    const obs = transaccion.OBS?.trim()
      ? `<div class="row"><span class="label">Observaciones</span><span class="value">${escapeHtml(transaccion.OBS)}</span></div>`
      : '';
    const fechaImpresion = escapeHtml(new Date().toLocaleString('es-GT'));
    const logoUrl = escapeHtml(getPrintLogoUrl());

    const printHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${tituloDocumento} #${numero}</title>
  <style>
    @page { size: letter; margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 11pt;
      color: #1a1a1a;
      margin: 0;
      line-height: 1.4;
    }
    .comprobante {
      max-width: 520px;
      margin: 0 auto;
      border: 1.5px solid #334155;
      padding: 22px 24px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-bottom: 14px;
      margin-bottom: 16px;
      border-bottom: 1.5px solid #334155;
    }
    .header img {
      width: 80px;
      height: auto;
      object-fit: contain;
    }
    .header-text h1 {
      font-size: 13pt;
      font-weight: 700;
      margin: 0 0 4px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .header-text .empresa {
      font-size: 10pt;
      margin: 0;
      color: #334155;
    }
    ${empresaContactCss()}
    .titulo {
      text-align: center;
      font-size: 12pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin: 0 0 18px;
      color: #0f172a;
    }
    .datos {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .row:last-child { border-bottom: none; }
    .label {
      font-size: 9.5pt;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }
    .value {
      font-size: 10.5pt;
      font-weight: 600;
      text-align: right;
    }
    .monto-box {
      text-align: center;
      padding: 14px 12px;
      margin: 8px 0 18px;
      background: #f8fafc;
      border: 1.5px solid #94a3b8;
    }
    .monto-box .label {
      display: block;
      margin-bottom: 6px;
      font-size: 9pt;
    }
    .monto-box .monto {
      font-size: 18pt;
      font-weight: 700;
      color: ${tipoInfo.colorMonto};
    }
    .tipo-badge {
      display: inline-block;
      padding: 4px 10px;
      border: 1px solid #94a3b8;
      border-radius: 4px;
      font-size: 9.5pt;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .footer {
      margin-top: 18px;
      padding-top: 12px;
      border-top: 1px solid #cbd5e1;
      text-align: center;
      font-size: 8.5pt;
      color: #64748b;
    }
    .gracias {
      margin-top: 8px;
      font-size: 9.5pt;
      color: #334155;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="comprobante">
    <header class="header">
      <img src="${logoUrl}" alt="Logo">
      <div class="header-text">
        <h1>${tituloDocumento}</h1>
        <p class="empresa">${empresaNombre}</p>
        ${contactoHtml}
      </div>
    </header>

    <p class="titulo">${subtitulo}</p>

    <div class="datos">
      <div class="row">
        <span class="label">No. comprobante</span>
        <span class="value">#${numero}</span>
      </div>
      <div class="row">
        <span class="label">Tipo</span>
        <span class="value"><span class="tipo-badge">${tipoComprobante}</span></span>
      </div>
      <div class="row">
        <span class="label">Paciente</span>
        <span class="value">${paciente}</span>
      </div>
      <div class="row">
        <span class="label">Fecha</span>
        <span class="value">${fecha}</span>
      </div>
      ${obs}
    </div>

    <div class="monto-box">
      <span class="label">${etiquetaMonto}</span>
      <div class="monto">${monto}</div>
    </div>

    <footer class="footer">
      <div>Impreso: ${fechaImpresion}</div>
      <div class="gracias">Gracias por su preferencia</div>
    </footer>
  </div>
</body>
</html>`;

    let iframe = document.getElementById('pagoPrintFrame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'pagoPrintFrame';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
      document.body.appendChild(iframe);
    }

    const printDoc = iframe.contentWindow?.document;
    if (!printDoc) {
      void alertError('No se pudo preparar la impresión');
      return;
    }

    printDoc.open();
    printDoc.write(printHtml);
    printDoc.close();

    const ejecutarPrint = () => {
      try {
        const logoImg = printDoc.querySelector('.header img');
        const lanzar = () => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        };

        if (logoImg && !logoImg.complete) {
          logoImg.onload = () => setTimeout(lanzar, 80);
          logoImg.onerror = () => setTimeout(lanzar, 80);
          return;
        }

        setTimeout(lanzar, 120);
      } catch (err) {
        void alertError(err.message || 'Error al imprimir');
      }
    };

    if (iframe.contentWindow?.document.readyState === 'complete') {
      ejecutarPrint();
    } else {
      iframe.onload = ejecutarPrint;
    }
  } catch (error) {
    void alertError(error.message || 'Error al generar el comprobante');
  }
}
