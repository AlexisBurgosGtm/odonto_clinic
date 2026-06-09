/**
 * Vista Tratamientos
 */
export function renderTratamientos() {
  return `
    <div class="page-header">
      <h2>Tratamientos</h2>
      <p>Catálogo y seguimiento de tratamientos dentales</p>
    </div>

    <div class="content-card">
      <div class="content-card-header">
        <h5><i class="fa-solid fa-tooth me-2 text-primary"></i>Tratamientos disponibles</h5>
        <button class="btn btn-sm btn-nuevo btn-rounded">
          <i class="fa-solid fa-plus me-1"></i>Nuevo tratamiento
        </button>
      </div>
      <div class="placeholder-content">
        <i class="fa-solid fa-tooth"></i>
        <h4>Catálogo de tratamientos</h4>
        <p>Los tratamientos y su seguimiento estarán disponibles próximamente</p>
      </div>
    </div>
  `;
}
