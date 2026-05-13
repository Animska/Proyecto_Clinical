/**
 * admin.js - Lógica específica para el rol de Administrador
 */

let solicitudesPendientes = [];

function adjuntar_eventos_admin(viewId) {
    if (viewId === 'view-admin-manage-doctors') {
        renderizar_tabla_medicos();
        cargar_especialidades_filtro();

        // Filtros combinados
        const aplicarFiltros = () => {
            const texto = document.getElementById('doctor-search')?.value || '';
            const especialidad = document.getElementById('doctor-specialty-filter')?.value || '';
            renderizar_tabla_medicos(texto, especialidad);
        };

        const searchInput = document.getElementById('doctor-search');
        if (searchInput) {
            searchInput.oninput = aplicarFiltros;
        }

        const specialtyFilter = document.getElementById('doctor-specialty-filter');
        if (specialtyFilter) {
            specialtyFilter.onchange = aplicarFiltros;
        }

        // Botón Añadir
        const btnAdd = document.getElementById('btn-add-doctor');
        if (btnAdd) {
            btnAdd.onclick = () => {
                const modalEl = document.getElementById('doctorModal');
                document.body.appendChild(modalEl);
                document.getElementById('doctor-form').reset();
                document.getElementById('edit-index').value = "";
                document.getElementById('modalTitle').textContent = "Añadir Nuevo Médico";
                document.getElementById('doctor-password').required = true;
                new bootstrap.Modal(modalEl).show();
            };
        }

        // Submit Formulario (Add/Edit)
        const docForm = document.getElementById('doctor-form');
        if (docForm) {
            docForm.onsubmit = async (e) => {
                e.preventDefault();
                const editIndex = document.getElementById('edit-index').value;

                const data = {
                    nombre: document.getElementById('doctor-name').value,
                    especialidad: document.getElementById('doctor-specialty').value,
                    email: document.getElementById('doctor-email').value,
                    estado: document.getElementById('doctor-status').value,
                    password: document.getElementById('doctor-password').value
                };

                try {
                    const url = editIndex === "" ? '/api/doctors' : `/api/doctors/${editIndex}`;
                    const method = editIndex === "" ? 'POST' : 'PUT';

                    await apiFetch(url, {
                        method: method,
                        body: JSON.stringify(data)
                    });

                    alert(editIndex === "" ? "¡Médico añadido con éxito!" : "¡Médico actualizado con éxito!");
                    const modalEl = document.getElementById('doctorModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();

                    docForm.reset();
                    renderizar_tabla_medicos();
                    cargar_especialidades_filtro();
                } catch (error) {
                    console.error("Error al procesar médico:", error);
                }
            };
        }
    }

    if (viewId === 'view-admin-calendar') {
        inicializar_calendario_admin();
        cargar_solicitudes_pendientes();
    }
}

function inicializar_calendario_admin() {
    const calendarEl = document.getElementById('calendar-admin');
    if (!calendarEl) return;

    const duraciones = {
        'Examen General': 0.5,
        'Tratamiento': 1,
        'Operación': 2
    };

    const calendar = new FullCalendar.Calendar(calendarEl, {
        themeSystem: 'bootstrap5',
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        locale: 'es',
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        slotDuration: '00:30:00',
        slotLabelInterval: '01:00:00',
        allDaySlot: false,
        height: 'auto',
        datesSet: function (info) {
            actualizar_indice_ocupacion(info.start, info.end);
        },
        slotLabelFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        events: async function (info, successCallback, failureCallback) {
            try {
                const data = await apiFetch('/api/appointments', {}, false);

                const events = data.map(c => {
                    const start = new Date(c.fecha_hora);
                    const duracionHoras = duraciones[c.motivo] || 1;
                    const end = new Date(start.getTime() + duracionHoras * 60 * 60 * 1000);

                    return {
                        id: c.id,
                        title: `${c.paciente_nombre} - ${c.medico_nombre}`,
                        start: start,
                        end: end,
                        backgroundColor: c.prioridad_alta ? 'rgba(220, 53, 69, 0.1)' : 'rgba(11, 94, 215, 0.1)',
                        borderColor: c.prioridad_alta ? '#dc3545' : '#0b5ed7',
                        textColor: c.prioridad_alta ? '#dc3545' : '#0b5ed7',
                        description: c.motivo
                    };
                });
                successCallback(events);
            } catch (error) {
                console.error("Error cargando eventos:", error);
                failureCallback(error);
            }
        },
        eventDidMount: function (info) {
            // Añadir tooltip o info extra si se desea
            if (info.event.extendedProps.description) {
                info.el.title = info.event.extendedProps.description;
            }
        }
    });

    calendar.render();

    // Guardar referencia en el window para poder recargar
    window.adminCalendar = calendar;
}

async function cargar_solicitudes_pendientes() {
    const contenedor = document.getElementById('contenedor-solicitudes');
    const template = document.getElementById('template-solicitud-cita');
    if (!contenedor || !template) return;

    try {
        const solicitudes = await apiFetch('/api/appointments/pending', {}, false);
        solicitudesPendientes = solicitudes;

        contenedor.innerHTML = '';

        if (solicitudes.length === 0) {
            contenedor.innerHTML = '<div class="text-center p-4 text-muted small">No hay solicitudes pendientes</div>';
            return;
        }

        solicitudes.forEach(s => {
            const clone = template.content.cloneNode(true);

            clone.querySelector('.t-paciente-nombre').textContent = s.paciente_nombre;
            clone.querySelector('.t-motivo').textContent = s.motivo;
            clone.querySelector('.t-fecha-hora').textContent = new Date(s.fecha_hora).toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            const prioridadTexto = clone.querySelector('.t-prioridad-texto');
            if (s.prioridad_alta) {
                clone.querySelector('.t-prioridad-badge').classList.remove('d-none');
                prioridadTexto.textContent = 'Prioridad Alta';
                prioridadTexto.classList.add('bg-danger', 'bg-opacity-10', 'text-danger');
            } else {
                prioridadTexto.textContent = 'Prioridad Normal';
                prioridadTexto.classList.add('bg-light', 'text-muted');
            }

            if (s.sintomas) {
                clone.querySelector('.t-contenedor-sintomas').classList.remove('d-none');
                clone.querySelector('.t-sintomas').textContent = s.sintomas;
            }

            clone.querySelector('.t-btn-aprobar').onclick = () => abrir_seleccion_medico(s.id);
            clone.querySelector('.t-btn-rechazar').onclick = () => procesar_rechazo(s.id);

            contenedor.appendChild(clone);
        });

    } catch (error) {
        contenedor.innerHTML = '<div class="alert alert-danger small">Error al cargar solicitudes</div>';
    }
}

// --- Funciones de Gestión de Solicitudes ---

async function abrir_seleccion_medico(appointmentId) {
    const modalEl = document.getElementById('modalSeleccionarMedico');
    const container = document.getElementById('lista-medicos-seleccion');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    container.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm text-primary" role="status"></div></div>';
    modal.show();

    try {
        const medicos = await apiFetch('/api/doctors', {}, false);

        container.innerHTML = '';
        medicos.forEach(m => {
            const btn = document.createElement('button');
            btn.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 border-0 rounded-3 mb-2 bg-light bg-opacity-50';
            btn.innerHTML = `
                <div>
                    <div class="fw-bold">${m.nombre}</div>
                    <div class="text-muted small">${m.especialidad}</div>
                </div>
                <i class="bi bi-chevron-right text-primary"></i>
            `;
            btn.onclick = async () => {
                await procesar_aprobacion(appointmentId, m.id);
                // Cerrar el modal explícitamente usando la instancia
                const inst = bootstrap.Modal.getInstance(modalEl);
                if (inst) inst.hide();
            };
            container.appendChild(btn);
        });
    } catch (error) {
        container.innerHTML = '<div class="alert alert-danger small">Error al cargar médicos</div>';
    }

    // Llamar a la IA para recomendación
    const solicitud = solicitudesPendientes.find(s => s.id === appointmentId);
    if (solicitud) {
        obtenerRecomendacionMedicoIA(solicitud);
    }
}

async function obtenerRecomendacionMedicoIA(solicitud) {
    const aiContainer = document.getElementById('ai-doctor-recommendation-container');
    const aiText = document.getElementById('ai-doctor-recommendation-text');
    if (!aiContainer || !aiText) return;

    aiContainer.classList.remove('d-none');
    aiText.innerHTML = '<div class="spinner-border spinner-border-sm text-primary me-2"></div> Analizando síntomas...';

    try {
        // Obtener médicos actuales para enviárselos a la IA
        const medicos = await apiFetch('/api/doctors', {}, false);
        const medicosSimplificados = medicos.filter(m => m.estado === 'Activo').map(m => ({ nombre: m.nombre, especialidad: m.especialidad }));

        const data = await apiFetch('/api/ai/recommend-doctor', {
            method: 'POST',
            body: JSON.stringify({
                sintomas: solicitud.sintomas || "No especificados",
                motivo: solicitud.motivo,
                doctores: medicosSimplificados
            })
        }, false);

        aiText.innerHTML = `<p class="mb-0 fade-in">${data.recommendation}</p>`;
    } catch (error) {
        aiContainer.classList.add('d-none');
    }
}

async function procesar_aprobacion(appointmentId, medicoId) {
    try {
        await apiFetch(`/api/appointments/${appointmentId}`, {
            method: 'PATCH',
            body: JSON.stringify({ estado: 'Aceptada', medico_id: medicoId })
        });

        cargar_solicitudes_pendientes();
        // Recargar calendario
        if (window.adminCalendar) {
            window.adminCalendar.refetchEvents();
        }
    } catch (error) {
        console.error("Error al aprobar cita:", error);
    }
}

async function procesar_rechazo(appointmentId) {
    if (!confirm("¿Estás seguro de que deseas rechazar esta solicitud?")) return;

    try {
        await apiFetch(`/api/appointments/${appointmentId}`, {
            method: 'PATCH',
            body: JSON.stringify({ estado: 'Rechazada' })
        });

        cargar_solicitudes_pendientes();
        if (window.adminCalendar) {
            window.adminCalendar.refetchEvents();
        }
    } catch (error) {
        console.error("Error al rechazar cita:", error);
    }
}

// --- Funciones de Gestión de Médicos ---
async function renderizar_tabla_medicos(filtroTexto = '', filtroEspecialidad = '') {
    const tbody = document.getElementById('doctors-table-body');
    const template = document.getElementById('doctor-row-template');
    if (!tbody || !template) return;

    tbody.innerHTML = '';

    try {
        const medicos = await apiFetch('/api/doctors', {}, false);

        const medicosFiltrados = medicos.filter(m => {
            const matchesTexto = m.nombre.toLowerCase().includes(filtroTexto.toLowerCase()) ||
                m.especialidad.toLowerCase().includes(filtroTexto.toLowerCase()) ||
                m.email.toLowerCase().includes(filtroTexto.toLowerCase());

            const matchesEspecialidad = filtroEspecialidad === '' || m.especialidad === filtroEspecialidad;

            return matchesTexto && matchesEspecialidad;
        });

        medicosFiltrados.forEach(m => {
            const clone = template.content.cloneNode(true);

            clone.querySelector('.row-name').textContent = m.nombre;
            clone.querySelector('.row-specialty').textContent = m.especialidad;
            clone.querySelector('.row-email').textContent = m.email;
            clone.querySelector('.row-date').textContent = m.fecha;

            const statusBadge = clone.querySelector('.row-status');
            statusBadge.textContent = m.estado;
            statusBadge.className = `badge rounded-pill row-status ${m.estado === 'Activo' ? 'bg-success-subtle text-success' :
                m.estado === 'De Baja' ? 'bg-warning-subtle text-warning' :
                    'bg-danger-subtle text-danger'
                }`;

            clone.querySelector('.btn-edit').onclick = () => preparar_edicion_medico(m);
            clone.querySelector('.btn-delete').onclick = () => eliminar_medico(m.id);

            tbody.appendChild(clone);
        });

        const totalEl = document.getElementById('stat-total-doctors');
        if (totalEl) totalEl.textContent = medicos.length;

        const activeEl = document.getElementById('stat-active-doctors');
        if (activeEl) {
            activeEl.textContent = medicos.filter(m => m.estado === 'Activo').length;
        }

        const leaveEl = document.getElementById('stat-leave-doctors');
        if (leaveEl) {
            leaveEl.textContent = medicos.filter(m => m.estado === 'De Baja').length;
        }

        const specEl = document.getElementById('stat-specialties');
        if (specEl) {
            const specs = [...new Set(medicos.map(m => m.especialidad))];
            specEl.textContent = specs.length;
        }

        // Actualizar contador de "Mostrando X de Y"
        const showingCountEl = document.getElementById('showing-count');
        if (showingCountEl) {
            showingCountEl.textContent = `Mostrando ${medicosFiltrados.length} de ${medicos.length} miembros del personal médico`;
        }

    } catch (error) {
        console.error("Error al cargar médicos:", error);
    }
}

async function cargar_especialidades_filtro() {
    const filterSelect = document.getElementById('doctor-specialty-filter');
    if (!filterSelect) return;

    try {
        const medicos = await apiFetch('/api/doctors', {}, false);

        const especialidades = [...new Set(medicos.map(m => m.especialidad))].sort();

        // Guardar valor actual para no perderlo
        const currentVal = filterSelect.value;

        // Limpiar excepto la primera opción
        filterSelect.innerHTML = '<option value="">Todas las Especialidades</option>';

        especialidades.forEach(esp => {
            const option = document.createElement('option');
            option.value = esp;
            option.textContent = esp;
            filterSelect.appendChild(option);
        });

        // Restaurar valor si aún existe
        if (especialidades.includes(currentVal)) {
            filterSelect.value = currentVal;
        }

    } catch (error) {
        console.error("Error al cargar especialidades:", error);
    }
}

function preparar_edicion_medico(m) {
    const modalEl = document.getElementById('doctorModal');
    document.body.appendChild(modalEl);
    document.getElementById('doctor-form').reset();

    document.getElementById('edit-index').value = m.id;
    document.getElementById('modalTitle').textContent = "Editar Médico: " + m.nombre;

    document.getElementById('doctor-name').value = m.nombre;
    document.getElementById('doctor-specialty').value = m.especialidad;
    document.getElementById('doctor-status').value = m.estado;
    document.getElementById('doctor-email').value = m.email;
    document.getElementById('doctor-password').value = ""; // Opcional en edición
    document.getElementById('doctor-password').required = false;

    new bootstrap.Modal(modalEl).show();
}

async function eliminar_medico(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar a este médico? Esta acción no se puede deshacer.")) return;

    try {
        await apiFetch(`/api/doctors/${id}`, {
            method: 'DELETE'
        });

        alert("Médico eliminado correctamente.");
        renderizar_tabla_medicos();
        cargar_especialidades_filtro();
    } catch (error) {
        console.error("Error al eliminar médico:", error);
    }
}

async function actualizar_indice_ocupacion(start, end) {
    const percEl = document.getElementById('occupancy-percentage');
    const barEl = document.getElementById('occupancy-bar');
    if (!percEl || !barEl) return;

    try {
        const medicos = await apiFetch('/api/doctors', {}, false);
        const numMedicos = medicos.filter(m => m.estado === 'Activo').length || 1;

        const citas = await apiFetch('/api/appointments', {}, false);

        const duraciones = {
            'Examen General': 0.5,
            'Tratamiento': 1,
            'Operación': 2
        };

        let horasOcupadas = 0;
        citas.forEach(c => {
            if (c.estado !== 'Rechazada' && c.estado !== 'Cancelado') {
                const fechaCita = new Date(c.fecha_hora);
                if (fechaCita >= start && fechaCita < end) {
                    horasOcupadas += duraciones[c.motivo] || 1;
                }
            }
        });

        // Calculamos los días laborables en el rango mostrado
        let diasLaborables = 0;
        let curr = new Date(start);
        while (curr < end) {
            if (curr.getDay() !== 0 && curr.getDay() !== 6) { // No Sáb/Dom
                diasLaborables++;
            }
            curr.setDate(curr.getDate() + 1);
        }

        // Si la vista es de mes, FullCalendar a veces incluye días de meses adyacentes.
        // Pero para el cálculo semanal (timeGridWeek), diasLaborables será 5 o 7.
        // Ajustamos la capacidad: 12h al día (8-20h)
        const capacidadTotal = diasLaborables * 12 * numMedicos;
        const porcentaje = capacidadTotal > 0 ? Math.min(Math.round((horasOcupadas / capacidadTotal) * 100), 100) : 0;

        percEl.textContent = `${porcentaje}%`;
        barEl.style.width = `${porcentaje}%`;

        // Cambiar color según ocupación
        barEl.className = 'progress-bar';
        if (porcentaje > 80) {
            barEl.classList.add('bg-danger');
            percEl.className = 'fw-bold text-danger mb-1';
        } else if (porcentaje > 50) {
            barEl.classList.add('bg-warning');
            percEl.className = 'fw-bold text-warning mb-1';
        } else {
            barEl.classList.add('bg-primary');
            percEl.className = 'fw-bold text-primary mb-1';
        }

    } catch (error) {
        console.error("Error al calcular ocupación:", error);
    }
}
