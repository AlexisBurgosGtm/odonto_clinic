/**
 * Vista de Login
 */
export function renderLogin() {
  return `
    <div class="login-wrapper login-enter">
      <div class="login-card">
        <div class="login-logo">
          <i class="fa-solid fa-tooth"></i>
        </div>
        <h1 class="login-title">Clínica Dental</h1>
        <p class="login-subtitle">Sistema de gestión integral</p>

        <div id="loginAlert"></div>

        <form id="loginForm" novalidate>
          <div class="mb-3">
            <label for="username" class="form-label">Usuario</label>
            <div class="input-group-icon">
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

          <div class="mb-3">
            <label for="password" class="form-label">Contraseña</label>
            <div class="input-group-icon">
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
            <i class="fa-solid fa-right-to-bracket me-2"></i>Iniciar Sesión
          </button>
        </form>
      </div>
    </div>
  `;
}

export function bindLoginEvents(onLogin) {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuario = document.getElementById('username').value.trim();
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
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket me-2"></i>Iniciar Sesión';
    }
  });
}
