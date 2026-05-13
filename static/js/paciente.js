/**
 * paciente.js - Lógica específica para el rol de Paciente
 */

function adjuntar_eventos_paciente(viewId) {
    if (viewId === 'view-patient-dashboard') {
        const btnRequest = document.getElementById('btn-nav-request');
        if (btnRequest) btnRequest.onclick = () => navegar_a('view-patient-request');

        const btnCalendar = document.getElementById('btn-nav-calendar');
        if (btnCalendar) btnCalendar.onclick = () => navegar_a('view-patient-calendar');

        // Cargar datos dinámicos del dashboard
        cargar_dashboard_paciente();
    }

    if (viewId === 'view-patient-request') {
        const btnBack = document.getElementById('btn-back-to-dashboard');
        if (btnBack) btnBack.onclick = () => navegar_a('view-patient-dashboard');

        const form = document.getElementById('consultation-form');
        if (form) {
            // Lógica para los botones visuales de motivo de visita
            const visitTypeRadios = form.querySelectorAll('input[name="visitType"]');
            visitTypeRadios.forEach(radio => {
                radio.addEventListener('change', () => {
                    // Limpiar clases de todos los labels
                    visitTypeRadios.forEach(r => {
                        const label = r.closest('label');
                        label.classList.remove('border-primary', 'bg-primary', 'bg-opacity-10');
                        label.classList.add('text-muted');
                        label.querySelector('i').classList.remove('text-primary');
                        label.querySelector('span').classList.remove('fw-semibold', 'text-primary');
                        label.querySelector('span').classList.add('fw-medium');
                    });

                    // Añadir clases al seleccionado
                    const activeLabel = radio.closest('label');
                    activeLabel.classList.add('border-primary', 'bg-primary', 'bg-opacity-10');
                    activeLabel.classList.remove('text-muted');
                    activeLabel.querySelector('i').classList.add('text-primary');
                    activeLabel.querySelector('span').classList.add('fw-semibold', 'text-primary');
                    activeLabel.querySelector('span').classList.remove('fw-medium');
                    
                    actualizarHorasDisponibles();
                });
            });

            const dateInput = document.getElementById('appointment-date');
            if (dateInput) {
                // Establecer fecha mínima como hoy
                const today = new Date().toISOString().split('T')[0];
                dateInput.min = today;
                dateInput.addEventListener('change', actualizarHorasDisponibles);
            }

            async function actualizarHorasDisponibles() {
                const dateInput = document.getElementById('appointment-date');
                const dateVal = dateInput.value;
                
                if (dateVal) {
                    const dateObj = new Date(dateVal);
                    const day = dateObj.getUTCDay(); // Usar UTC para evitar problemas de zona horaria con input date
                    
                    // Listado de festivos nacionales comunes
                    const festivos = ['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'];
                    const currentMD = dateVal.substring(5); // Obtiene MM-DD

                    if (day === 0 || day === 6 || festivos.includes(currentMD)) {
                        alert("La clínica permanece cerrada los fines de semana y festivos. Por favor, selecciona un día laborable (Lunes a Viernes).");
                        dateInput.value = "";
                        document.getElementById('appointment-time').innerHTML = '<option value="" disabled selected>Selecciona una fecha primero</option>';
                        return;
                    }
                }

                const motivoInput = form.querySelector('input[name="visitType"]:checked');
                const motivo = motivoInput ? motivoInput.value : "Examen General";
                const timeSelect = document.getElementById('appointment-time');
                
                if (!dateVal) {
                    timeSelect.innerHTML = '<option value="" disabled selected>Selecciona una fecha primero</option>';
                    return;
                }

                timeSelect.innerHTML = '<option value="" disabled selected>Cargando horas...</option>';
                
                try {
                    const data = await apiFetch(`/api/appointments/available_slots?fecha=${dateVal}&motivo=${encodeURIComponent(motivo)}`, {}, false);
                    const slots = data.available_slots;
                        
                    if (slots && slots.length > 0) {
                        timeSelect.innerHTML = '<option value="" disabled selected>Selecciona una hora</option>';
                        
                        // Mapeo de duraciones para mostrar en el frontend
                        const duraciones = {
                            "Examen General": 30,
                            "Tratamiento": 60,
                            "Operación": 120
                        };
                        const duracion = duraciones[motivo] || 30;

                        slots.forEach(slot => {
                            // Calcular hora de fin para mostrar el rango
                            const [h, m] = slot.split(':').map(Number);
                            const dateObj = new Date();
                            dateObj.setHours(h, m, 0);
                            const finObj = new Date(dateObj.getTime() + duracion * 60000);
                            
                            const horaInicio = slot.substring(0, 5);
                            const horaFin = finObj.toTimeString().substring(0, 5);

                            const option = document.createElement('option');
                            option.value = slot;
                            option.textContent = `${horaInicio} - ${horaFin}`;
                            timeSelect.appendChild(option);
                        });

                        // Obtener recomendación de la IA
                        obtenerRecomendacionIA(slots, dateVal, motivo);
                    } else {
                        timeSelect.innerHTML = '<option value="" disabled selected>No hay huecos disponibles</option>';
                    }
                } catch (error) {
                    console.error("Error al obtener huecos:", error);
                }
            }

            async function obtenerRecomendacionIA(slots, fecha, motivo) {
                const aiTextEl = document.getElementById('ai-response-text');
                const aiContainer = document.getElementById('ai-container');
                const aiRecommendationText = document.getElementById('ai-response-text');
                const sintomas = document.getElementById('appointment-symptoms').value;
                if (!aiTextEl) return;

                aiTextEl.innerHTML = '<div class="d-flex align-items-center"><div class="spinner-border spinner-border-sm text-primary me-2"></div> <span class="text-primary fw-medium">Consultando con nuestro asistente...</span></div>';

                try {
                    const data = await apiFetch('/api/ai/recommend', {
                        method: 'POST',
                        body: JSON.stringify({ slots, fecha, motivo, sintomas })
                    }, false);
                    
                    if (aiContainer) aiContainer.classList.remove('d-none');
                    aiRecommendationText.innerHTML = `<p class="mb-0 fade-in">${data.recommendation}</p>`;
                } catch (error) {
                    if (aiContainer) aiContainer.classList.add('d-none');
                    console.error("Error al obtener recomendación IA:", error);
                    aiTextEl.innerHTML = '<p class="mb-0 text-muted italic">Elige la hora que mejor te venga para tu consulta.</p>';
                }
            }

            form.onsubmit = async (e) => {
                e.preventDefault();

                // Recopilar datos
                const motivoInput = form.querySelector('input[name="visitType"]:checked');
                const motivo = motivoInput ? motivoInput.value : "Examen General";
                const fecha = document.getElementById('appointment-date').value;
                const hora = document.getElementById('appointment-time').value;
                const sintomas = document.getElementById('appointment-symptoms').value;
                const prioridadAlta = document.getElementById('appointment-priority').checked;

                const data = {
                    paciente_id: AppState.usuarioActual.paciente_id,
                    fecha_hora: `${fecha} ${hora}`,
                    motivo: motivo,
                    sintomas: sintomas,
                    prioridad_alta: prioridadAlta
                };

                try {
                    await apiFetch('/api/appointments', {
                        method: 'POST',
                        body: JSON.stringify(data)
                    });

                    alert("¡Solicitud enviada con éxito!");
                    navegar_a('view-patient-dashboard');
                } catch (error) {
                    console.error("Error enviando cita:", error);
                }
            };
        }
    }

    if (viewId === 'view-patient-calendar') {
        inicializar_calendario_paciente();
    }

    if (viewId === 'view-patient-history') {
        const btnBack = document.getElementById('btn-back-to-dashboard');
        if (btnBack) btnBack.onclick = () => navegar_a('view-patient-dashboard');

        cargar_historial_paciente();
    }
}

async function cargar_dashboard_paciente() {
    const pacienteId = AppState.usuarioActual.paciente_id;
    const nombreElement = document.getElementById('nombre-paciente-dashboard');
    const resumenElement = document.getElementById('resumen-citas-paciente');
    const containerCitas = document.getElementById('container-citas-activas');
    const templateCita = document.getElementById('tmpl-cita-paciente');

    if (nombreElement) nombreElement.innerText = AppState.usuarioActual.nombre;

    try {
        const citas = await apiFetch(`/api/appointments/patient/${pacienteId}`, {}, false);

        if (resumenElement) {
            resumenElement.innerText = `Tienes ${citas.length} citas programadas para este mes.`;
        }

        if (containerCitas) {
            if (citas.length === 0) {
                containerCitas.innerHTML = `
                    <div class="text-center py-4 text-muted border rounded-3 bg-light">
                        <i class="bi bi-calendar-x fs-2 d-block mb-2"></i>
                        No tienes citas activas.
                    </div>
                `;
            } else {
                containerCitas.innerHTML = '';
                citas.forEach(cita => {
                    const fecha = new Date(cita.fecha_hora);
                    const dia = fecha.getDate();
                    const mes = fecha.toLocaleString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
                    const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                    // Usar el template
                    const clone = templateCita.content.cloneNode(true);

                    clone.querySelector('.item-dia').innerText = dia;
                    clone.querySelector('.item-mes').innerText = mes;
                    clone.querySelector('.item-motivo').innerText = cita.motivo;
                    clone.querySelector('.item-medico').innerText = cita.medico_nombre || "Pendiente de asignar";
                    clone.querySelector('.item-hora').innerText = hora;

                    const badge = clone.querySelector('.item-estado');
                    badge.innerText = cita.estado;
                    if (cita.estado === 'Aceptada') {
                        badge.classList.add('bg-success', 'text-success');
                    } else {
                        badge.classList.add('bg-warning', 'text-warning');
                    }

                    const btnCancelar = clone.querySelector('.item-btn-cancelar');
                    btnCancelar.onclick = () => cancelar_cita(cita.id);

                    containerCitas.appendChild(clone);
                });
            }
        }
    } catch (error) {
        console.error("Error al cargar dashboard:", error);
        if (containerCitas) {
            containerCitas.innerHTML = '<div class="alert alert-danger">Error al cargar las citas.</div>';
        }
    }

    // Cargar último informe
    const containerHistorial = document.getElementById('container-historial-paciente');
    const pacienteId_report = AppState.usuarioActual.paciente_id;
    try {
        const informe = await apiFetch(`/api/reports/patient/${pacienteId_report}/latest`, {}, false);
        if (informe && containerHistorial) {
            containerHistorial.innerHTML = `
                <div class="border rounded-3 p-3 bg-white mb-2 d-flex align-items-center shadow-sm">
                    <div class="flex-grow-1">
                        <h6 class="mb-0 small fw-bold">${informe.medico_nombre}</h6>
                        <p class="small text-muted mb-0">Informe médico &bull; ${informe.fecha_cita}</p>
                    </div>
                    <button class="btn btn-sm btn-link text-primary text-decoration-none fw-semibold" id="btn-ver-informe-dash">
                        Ver Informe
                    </button>
                </div>
            `;
            document.getElementById('btn-ver-informe-dash').onclick = () => mostrar_detalle_informe(informe);
        } else if (containerHistorial) {
            containerHistorial.innerHTML = `
                <div class="text-center py-3 text-muted border rounded-3 bg-light small">
                    No hay informes médicos disponibles todavía.
                </div>
            `;
        }
    } catch (error) {
        // Si es 404 (lanzado por apiFetch si el status es 404), simplemente mostramos que no hay informes
        if (containerHistorial) {
            containerHistorial.innerHTML = `
                <div class="text-center py-3 text-muted border rounded-3 bg-light small">
                    No hay informes médicos disponibles todavía.
                </div>
            `;
        }
    }
}

function mostrar_detalle_informe(informe) {
    document.getElementById('view-report-doctor').innerText = informe.medico_nombre;
    document.getElementById('view-report-date').innerText = informe.fecha_cita;
    document.getElementById('view-report-height').innerText = informe.vitals_altura;
    document.getElementById('view-report-weight').innerText = informe.vitals_peso;
    document.getElementById('view-report-resp').innerText = informe.vitals_respiracion;
    document.getElementById('view-report-pressure').innerText = informe.vitals_presion;
    document.getElementById('view-report-observations').innerText = informe.observaciones;

    const modalElement = document.getElementById('viewReportModal');
    if (modalElement) {
        document.body.appendChild(modalElement);
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

async function cargar_historial_paciente() {
    const pacienteId = AppState.usuarioActual.paciente_id;
    const tableBody = document.getElementById('table-history-body');
    const templateRow = document.getElementById('tmpl-history-row');

    try {
        const citas = await apiFetch(`/api/appointments/patient/${pacienteId}/history`, {}, false);

        if (tableBody) {
            if (citas.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No tienes historial de citas.</td></tr>';
            } else {
                tableBody.innerHTML = '';
                citas.forEach(cita => {
                    const fecha = new Date(cita.fecha_hora).toLocaleString('es-ES', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    });

                    const clone = templateRow.content.cloneNode(true);
                    clone.querySelector('.item-fecha').innerText = fecha;
                    const medicoTexto = cita.medico_nombre ? `${cita.medico_nombre} (${cita.medico_especialidad})` : "No asignado todavía";
                    clone.querySelector('.item-medico').innerText = medicoTexto;
                    clone.querySelector('.item-motivo').innerText = cita.motivo;

                    const badge = clone.querySelector('.item-estado');
                    badge.innerText = cita.estado;

                    // Colores según estado
                    const colores = {
                        'Pendiente': 'bg-warning text-warning',
                        'Aceptada': 'bg-success text-success',
                        'Completado': 'bg-info text-info',
                        'Cancelado': 'bg-danger text-danger',
                        'Rechazada': 'bg-secondary text-secondary'
                    };
                    badge.className = `badge rounded-pill bg-opacity-10 ${colores[cita.estado] || 'bg-light text-dark'}`;

                    tableBody.appendChild(clone);
                });
            }
        }
    } catch (error) {
        console.error("Error al cargar historial:", error);
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Error al cargar el historial.</td></tr>';
        }
    }
}

async function cancelar_cita(citaId) {
    if (!confirm("¿Estás seguro de que deseas cancelar esta cita?")) return;

    try {
        await apiFetch(`/api/appointments/${citaId}`, {
            method: 'PATCH',
            body: JSON.stringify({ estado: 'Cancelado' })
        });

        alert("Cita cancelada correctamente.");
        cargar_dashboard_paciente(); // Recargar el dashboard
    } catch (error) {
        console.error("Error al cancelar cita:", error);
        alert("Error de conexión al cancelar la cita.");
    }
}

function inicializar_calendario_paciente() {
    const calendarEl = document.getElementById('calendar-paciente');
    if (!calendarEl) return;

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
        slotLabelFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        allDaySlot: false,
        height: 'auto',
        events: async function (info, successCallback, failureCallback) {
            try {
                const pacienteId = AppState.usuarioActual.paciente_id;
                const citas = await apiFetch(`/api/appointments/patient/${pacienteId}`, {}, false);

                const events = citas.map(cita => ({
                    title: `${cita.motivo} - ${cita.medico_nombre}`,
                    start: cita.fecha_hora,
                    backgroundColor: cita.estado === 'Aceptada' ? 'rgba(25, 135, 84, 0.1)' : 'rgba(255, 193, 7, 0.1)',
                    borderColor: cita.estado === 'Aceptada' ? '#198754' : '#ffc107',
                    textColor: cita.estado === 'Aceptada' ? '#198754' : '#ffc107'
                }));

                successCallback(events);
            } catch (error) {
                console.error("Error al cargar eventos del calendario:", error);
                failureCallback(error);
            }
        }
    });

    calendar.render();
}
