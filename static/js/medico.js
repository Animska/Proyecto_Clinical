/**
 * medico.js - Lógica específica para el rol de Médico
 */

let citaSeleccionadaId = null;
let fechaSeleccionada = new Date();
let citasActuales = [];

function adjuntar_eventos_medico(viewId) {
    if (viewId === 'view-doctor-dashboard') {
        const btnPrev = document.getElementById('btn-prev-day');
        const btnNext = document.getElementById('btn-next-day');

        if (btnPrev) {
            btnPrev.onclick = () => {
                fechaSeleccionada.setDate(fechaSeleccionada.getDate() - 1);
                cargar_dashboard_medico();
            };
        }

        if (btnNext) {
            btnNext.onclick = () => {
                fechaSeleccionada.setDate(fechaSeleccionada.getDate() + 1);
                cargar_dashboard_medico();
            };
        }

        configurar_busqueda();
        cargar_dashboard_medico();
    }
}

async function cargar_dashboard_medico() {
    const medicoId = AppState.usuarioActual.medico_id;
    const fechaStr = fechaSeleccionada.toISOString().split('T')[0];

    // Actualizar texto de fecha en la UI
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const fechaTexto = fechaSeleccionada.toLocaleDateString('es-ES', options);
    const fechaEl = document.getElementById('fecha-actual');
    if (fechaEl) fechaEl.innerText = fechaTexto;

    const contenedor = document.getElementById('contenedor-agenda');
    const resumenEl = document.getElementById('resumen-citas');

    try {
        citasActuales = await apiFetch(`/api/appointments/doctor/${medicoId}?fecha=${fechaStr}`, {}, false);

        if (resumenEl) {
            resumenEl.innerText = `Tienes ${citasActuales.length} citas programadas para hoy.`;
        }

        renderizar_agenda();

        // Mostrar el primero por defecto si hay citas y no hay ninguna seleccionada
        if (citasActuales.length > 0 && !citaSeleccionadaId) {
            mostrar_detalle_paciente(citasActuales[0].id);
        } else if (citasActuales.length === 0) {
            const detalleVacio = document.getElementById('detalle-paciente-vacio');
            const detalleContenido = document.getElementById('detalle-paciente-contenido');
            if (detalleVacio) detalleVacio.classList.remove('d-none');
            if (detalleContenido) detalleContenido.classList.add('d-none');
            citaSeleccionadaId = null;
        }
    } catch (error) {
        if (contenedor) contenedor.innerHTML = '<div class="alert alert-danger">Error al cargar la agenda.</div>';
    }
}

function renderizar_agenda(filtro = '') {
    const contenedor = document.getElementById('contenedor-agenda');
    const template = document.getElementById('template-item-agenda');
    if (!contenedor || !template) return;

    const citasFiltradas = citasActuales.filter(c =>
        c.paciente_nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        c.motivo.toLowerCase().includes(filtro.toLowerCase())
    );

    if (citasFiltradas.length === 0) {
        contenedor.innerHTML = '<div class="text-center p-4 text-muted small">No se encontraron pacientes</div>';
        return;
    }

    contenedor.innerHTML = '';
    citasFiltradas.forEach(cita => {
        const isActive = cita.id === citaSeleccionadaId;
        const hora = new Date(cita.fecha_hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        const clone = template.content.cloneNode(true);
        const itemDiv = clone.querySelector('.agenda-item');

        itemDiv.dataset.id = cita.id;
        clone.querySelector('.item-hora').innerText = hora;
        clone.querySelector('.item-paciente').innerText = cita.paciente_nombre;
        clone.querySelector('.item-motivo').innerText = cita.motivo;

        const badge = clone.querySelector('.item-hora');
        if (cita.estado === 'Aceptada') badge.classList.add('bg-primary', 'bg-opacity-10', 'text-primary');
        else if (cita.estado === 'Completado') badge.classList.add('bg-success', 'bg-opacity-10', 'text-success');
        else if (cita.estado === 'Cancelado') badge.classList.add('bg-danger', 'bg-opacity-10', 'text-danger');
        else badge.classList.add('bg-light', 'text-muted');

        if (isActive) {
            itemDiv.classList.add('border-primary', 'border-start', 'border-4', 'shadow-sm');
            clone.querySelector('.item-viendo').classList.remove('d-none');
        } else {
            itemDiv.classList.add('border-light', 'cursor-pointer');
        }

        itemDiv.onclick = () => mostrar_detalle_paciente(cita.id);

        contenedor.appendChild(clone);
    });
}

function configurar_busqueda() {
    const inputBusqueda = document.getElementById('buscar-paciente');
    if (inputBusqueda) {
        inputBusqueda.oninput = (e) => {
            renderizar_agenda(e.target.value);
        };
    }
}

function mostrar_detalle_paciente(id) {
    const cita = citasActuales.find(c => c.id === id);
    if (!cita) return;

    citaSeleccionadaId = id;

    // Volver a renderizar la agenda para actualizar el estado "Viendo"
    renderizar_agenda(document.getElementById('buscar-paciente')?.value || '');

    const contenedor = document.getElementById('detalle-paciente-contenido');
    const template = document.getElementById('template-informe-paciente');

    if (!contenedor || !template) return;

    contenedor.innerHTML = '';
    const clone = template.content.cloneNode(true);

    // Helper para asignar texto de forma segura
    const setTexto = (selector, texto) => {
        const el = clone.querySelector(selector);
        if (el) el.textContent = texto;
    };

    const setHtml = (selector, html) => {
        const el = clone.querySelector(selector);
        if (el) el.innerHTML = html;
    };

    setTexto('.t-nombre-paciente', cita.paciente_nombre);
    setHtml('.t-info-sangre', `<i class="bi bi-droplet me-1"></i> ${cita.grupo_sanguineo || 'N/A'}`);
    setTexto('.t-alergias-paciente', cita.alergias || 'Ninguna conocida');

    setTexto('.t-vital-altura', cita.vitals_altura || '--');
    setTexto('.t-vital-peso', cita.vitals_peso || '--');
    setTexto('.t-vital-respiracion', cita.vitals_respiracion || '--');
    setTexto('.t-vital-presion', cita.vitals_presion || '--/--');

    setTexto('.t-observaciones-paciente', cita.observaciones || 'Sin observaciones previas.');

    // Adjuntar eventos a los botones del detalle
    const btnCancelar = clone.querySelector('.t-btn-cancelar-cita');
    if (btnCancelar) {
        btnCancelar.onclick = () => cancelar_cita_medico(id);
    }

    const btnFinalizar = clone.querySelector('.t-btn-finalizar-chequeo');
    if (btnFinalizar) {
        // Ahora simplemente marca como completado sin abrir modal
        btnFinalizar.onclick = () => finalizar_chequeo_directo(id);
    }

    const btnEditar = clone.querySelector('.t-btn-editar-informe');
    if (btnEditar) {
        btnEditar.onclick = () => abrir_modal_informe(id);
    }

    contenedor.appendChild(clone);

    document.getElementById('detalle-paciente-vacio').classList.add('d-none');
    contenedor.classList.remove('d-none');
}

async function cancelar_cita_medico(citaId) {
    if (!confirm("¿Estás seguro de que deseas cancelar esta cita?")) return;

    try {
        await apiFetch(`/api/appointments/${citaId}`, {
            method: 'PATCH',
            body: JSON.stringify({ estado: 'Cancelado' })
        });

        alert("Cita cancelada correctamente.");
        cargar_dashboard_medico();
    } catch (error) {
        console.error("Error al cancelar cita:", error);
    }
}

async function finalizar_chequeo_directo(citaId, asistio = true) {
    if (!confirm("¿Deseas dar por finalizado el chequeo y marcar la cita como completada?")) return;

    try {
        const url = `/api/appointments/${citaId}`;
        const body = { estado: asistio ? 'Completado' : 'No asistió' };

        await apiFetch(url, {
            method: 'PATCH',
            body: JSON.stringify(body)
        });

        alert("Cita marcada como completada.");
        cargar_dashboard_medico();
    } catch (error) {
        console.error("Error al finalizar cita:", error);
    }
}

function abrir_modal_informe(id) {
    const cita = citasActuales.find(c => c.id === id);
    if (!cita) return;

    const modalBody = document.getElementById('modal-report-body');
    const template = document.getElementById('template-formulario-informe');

    if (!modalBody || !template) return;

    modalBody.innerHTML = '';
    const clone = template.content.cloneNode(true);

    const setVal = (selector, val) => {
        const el = clone.querySelector(selector);
        if (el) el.value = val;
    };

    clone.querySelector('.t-nombre-paciente').textContent = cita.paciente_nombre;
    const infoSangre = clone.querySelector('.t-info-sangre');
    if (infoSangre) infoSangre.innerHTML = `<i class="bi bi-droplet me-1"></i> ${cita.grupo_sanguineo || 'N/A'}`;

    const alergias = clone.querySelector('.t-alergias-paciente');
    if (alergias) alergias.textContent = cita.alergias || 'Ninguna conocida';

    setVal('.t-input-altura', cita.vitals_altura || '');
    setVal('.t-input-peso', cita.vitals_peso || '');
    setVal('.t-input-respiracion', cita.vitals_respiracion || '');
    setVal('.t-input-presion', cita.vitals_presion || '');
    setVal('.t-textarea-observaciones', cita.observaciones || '');
    const form = clone.querySelector('#form-actualizar-informe');

    // --- Lógica de Sugerencia IA ---
    const btnAi = clone.querySelector('#btn-ai-suggest');
    if (btnAi) {
        btnAi.onclick = async () => {
            const altura = form.querySelector('.t-input-altura').value;
            const peso = form.querySelector('.t-input-peso').value;
            const respiracion = form.querySelector('.t-input-respiracion').value;
            const presion = form.querySelector('.t-input-presion').value;
            const textarea = form.querySelector('.t-textarea-observaciones');

            if (!altura || !peso || !respiracion || !presion) {
                alert("Por favor, rellena los vitales primero para que la IA pueda analizarlos.");
                return;
            }

            btnAi.innerHTML = '<i class="spinner-border spinner-border-sm me-1"></i> Analizando...';
            btnAi.disabled = true;

            try {
                const data = await apiFetch('/api/ai/suggest-report', {
                    method: 'POST',
                    body: JSON.stringify({
                        altura: parseFloat(altura),
                        peso: parseFloat(peso),
                        respiracion: parseInt(respiracion),
                        presion: presion,
                        especialidad: AppState.usuarioActual.especialidad || 'Medicina General',
                        sintomas: cita.sintomas || null
                    })
                }, false);
                textarea.value = data.suggestion;
            } catch (error) {
                console.error("Error al obtener sugerencia IA:", error);
            } finally {
                btnAi.innerHTML = '<i class="bi bi-magic me-1"></i> Sugerencia IA';
                btnAi.disabled = false;
            }
        };
    }

    form.onsubmit = async (e) => {
        e.preventDefault();

        const reportData = {
            cita_id: id,
            vitals_altura: parseInt(form.querySelector('.t-input-altura').value),
            vitals_peso: parseInt(form.querySelector('.t-input-peso').value),
            vitals_respiracion: parseInt(form.querySelector('.t-input-respiracion').value),
            vitals_presion: form.querySelector('.t-input-presion').value,
            observaciones: form.querySelector('.t-textarea-observaciones').value
        };

        try {
            await apiFetch('/api/reports', {
                method: 'POST',
                body: JSON.stringify(reportData)
            });

            alert("¡Informe guardado y chequeo finalizado con éxito!");
            
            // Cerrar modal
            const modalEl = document.getElementById('reportModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            // Recargar dashboard
            cargar_dashboard_medico();
        } catch (error) {
            console.error("Error al finalizar chequeo:", error);
            alert("Error de conexión al finalizar el chequeo.");
        }
    };

    modalBody.appendChild(clone);
    const modalEl = document.getElementById('reportModal');
    document.body.appendChild(modalEl);
    let modal = bootstrap.Modal.getInstance(modalEl);
    if (!modal) modal = new bootstrap.Modal(modalEl);
    modal.show();
}
