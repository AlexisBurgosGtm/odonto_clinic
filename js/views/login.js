/**
 * Vista de Login
 */
import { sanitizeText } from '../utils/sanitize.js';

export function renderLogin() {
  return `
    <div class="login-scene login-enter">
      <div class="login-aurora login-aurora--a"></div>
      <div class="login-aurora login-aurora--b"></div>
      <div class="login-aurora login-aurora--c"></div>
      <div class="login-noise"></div>

      <div class="login-shell">
        <div class="login-glass">
          <div class="login-glass-glow"></div>

          <header class="login-header">
            <img src="./icons/login.png" alt="DENTAL STATE" class="login-logo-img">
          </header>

          <div id="loginAlert"></div>

          <form id="loginForm" class="login-form" novalidate>
            <div class="login-field">
              <label for="username" class="form-label">Usuario</label>
              <div class="login-input-wrap">
                <i class="fa-solid fa-user"></i>
                <input
                  type="text"
                  class="form-control"
                  id="username"
                  placeholder="Ingrese su usuario"
                  autocomplete="username"
                  required
                >
              </div>
            </div>

            <div class="login-field">
              <label for="password" class="form-label">Contraseña</label>
              <div class="login-input-wrap">
                <i class="fa-solid fa-lock"></i>
                <input
                  type="password"
                  class="form-control"
                  id="password"
                  placeholder="Ingrese su contraseña"
                  autocomplete="current-password"
                  required
                >
              </div>
            </div>

            <button type="submit" class="btn btn-login" id="btnLogin">
              <span class="btn-login-shine"></span>
              <i class="fa-solid fa-right-to-bracket me-2"></i>Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function bindLoginEvents(onLogin) {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuario = sanitizeText(document.getElementById('username').value, { maxLength: 255 });
    const clave = document.getElementById('password').value;
    const btn = document.getElementById('btnLogin');
    const alertEl = document.getElementById('loginAlert');

    if (!usuario || !clave) {
      alertEl.innerHTML = `
        <div class="alert alert-danger py-2 mb-3" role="alert">
          Ingrese usuario y contraseña
        </div>
      `;
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Ingresando...';
    alertEl.innerHTML = '';

    try {
      await onLogin(usuario, clave);
    } catch (error) {
      alertEl.innerHTML = `
        <div class="alert alert-danger py-2 mb-3" role="alert">
          ${error.message}
        </div>
      `;
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-login-shine"></span><i class="fa-solid fa-right-to-bracket me-2"></i>Iniciar Sesión';
    }
  });
}
