/**
 * Vista Dashboard
 */
export function renderDashboard() {
  return `
    <div class="page-header">
      <h2>Dashboard</h2>
      <p>Resumen general de la clínica dental</p>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-sm-6 col-xl-3">
        <div class="stat-card">
          <div class="stat-card-icon" style="background: #e0f2fe;">
            <i class="fa-solid fa-calendar-check" style="color: #0ea5e9;"></i>
          </div>
          <div class="stat-card-value">24</div>
          <div class="stat-card-label">Citas hoy</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="stat-card">
          <div class="stat-card-icon" style="background: #d1fae5;">
            <i class="fa-solid fa-users" style="color: #10b981;"></i>
          </div>
          <div class="stat-card-value">1,284</div>
          <div class="stat-card-label">Pacientes activos</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="stat-card">
          <div class="stat-card-icon" style="background: #fef3c7;">
            <i class="fa-solid fa-tooth" style="color: #f59e0b;"></i>
          </div>
          <div class="stat-card-value">18</div>
          <div class="stat-card-label">Tratamientos en curso</div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="stat-card">
          <div class="stat-card-icon" style="background: #ede9fe;">
            <i class="fa-solid fa-user-doctor" style="color: #8b5cf6;"></i>
          </div>
          <div class="stat-card-value">8</div>
          <div class="stat-card-label">Empleados activos</div>
        </div>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-8">
        <div class="content-card">
          <div class="content-card-header">
            <h5><i class="fa-solid fa-calendar-days me-2 text-primary"></i>Próximas citas</h5>
          </div>
          <div class="placeholder-content" style="padding: 2rem 1rem;">
            <i class="fa-solid fa-clock" style="font-size: 2rem;"></i>
            <p class="mb-0">Las citas del día se mostrarán aquí</p>
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="content-card">
          <div class="content-card-header">
            <h5><i class="fa-solid fa-bell me-2 text-primary"></i>Actividad reciente</h5>
          </div>
          <div class="placeholder-content" style="padding: 2rem 1rem;">
            <i class="fa-solid fa-list-check" style="font-size: 2rem;"></i>
            <p class="mb-0">Notificaciones y actividad reciente</p>
          </div>
        </div>
      </div>
    </div>
  `;
}
