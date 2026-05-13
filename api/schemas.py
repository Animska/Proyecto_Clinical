from pydantic import BaseModel
from typing import Dict, Any, Optional

class LoginRequest(BaseModel):
    email: str
    password: str
    role: str

class LoginResponse(BaseModel):
    message: str
    user_data: Dict[str, Any]

class RegisterPatientRequest(BaseModel):
    nombre: str
    dni: str
    telefono: str
    email: str
    password: str

class PatientProfileResponse(BaseModel):
    id: int
    usuario_id: int
    nombre: str
    dni: str
    email: str
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    grupo_sanguineo: Optional[str] = None
    alergias: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    nombre: str
    email: str
    telefono: str
    direccion: Optional[str] = None
    grupo_sanguineo: Optional[str] = None
    alergias: Optional[str] = None

class RegisterDoctorRequest(BaseModel):
    nombre: str
    especialidad: str
    email: str
    password: str
    estado: str = "Activo"

class DoctorResponse(BaseModel):
    id: int
    usuario_id: int
    nombre: str
    especialidad: str
    email: str
    estado: str
    fecha: str # Usaremos string para simplificar el envío desde la BD

class DoctorUpdate(BaseModel):
    nombre: str
    especialidad: str
    email: str
    password: Optional[str] = None
    estado: str

class AppointmentCreate(BaseModel):
    paciente_id: int
    medico_id: Optional[int] = None
    fecha_hora: str
    motivo: str
    sintomas: Optional[str] = None
    prioridad_alta: bool = False

class AppointmentUpdate(BaseModel):
    estado: str
    medico_id: Optional[int] = None

class PatientReportCreate(BaseModel):
    cita_id: int
    paciente_id: Optional[int] = None
    vitals_altura: int
    vitals_peso: int
    vitals_respiracion: int
    vitals_presion: str
    observaciones: str

class PatientReportResponse(BaseModel):
    id: int
    paciente_id: int
    cita_id: Optional[int] = None
    vitals_altura: int
    vitals_peso: int
    vitals_respiracion: int
    vitals_presion: str
    observaciones: str
    fecha_cita: str
    medico_nombre: str
