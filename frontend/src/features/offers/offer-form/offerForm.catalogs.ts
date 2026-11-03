// Opciones sugeridas del formulario de ofertas. Son ayudas: el backend solo
// exige formato y longitud en área, programas, ciudad, habilidades y beneficios,
// así que la empresa puede escribir una opción que no esté en la lista.
import type { OfferType } from "../offers.model";

export const AREAS = [
  "Tecnología",
  "Ingeniería",
  "Administración",
  "Contabilidad y finanzas",
  "Mercadeo y ventas",
  "Comunicación",
  "Recursos humanos",
  "Derecho",
  "Diseño",
  "Producción y logística",
  "Ambiental",
  "Salud",
  "Educación",
  "Turismo y hotelería",
  "Ciencias sociales",
];

// Programas sugeridos; la empresa puede agregar otros.
export const PROGRAMS = [
  "Administración de Empresas",
  "Administración Financiera",
  "Arquitectura",
  "Ciencia Política",
  "Comunicación Social y Periodismo",
  "Contaduría Pública",
  "Derecho",
  "Diseño",
  "Economía",
  "Ingeniería Agroindustrial",
  "Ingeniería Ambiental",
  "Ingeniería Civil",
  "Ingeniería de Sistemas",
  "Ingeniería Electrónica",
  "Ingeniería Industrial",
  "Ingeniería Mecánica",
  "Mercadeo",
  "Negocios Internacionales",
  "Psicología",
];

export const REMOTE_CITY = "Todo el país (remoto)";
export const CITIES = [
  "Ibagué",
  "Bogotá",
  "Medellín",
  "Cali",
  "Barranquilla",
  "Bucaramanga",
  "Pereira",
  "Manizales",
  "Armenia",
  "Neiva",
  "Villavicencio",
  "Cartagena",
  "Espinal",
  "Melgar",
];

export const LANGUAGES = ["Inglés", "Francés", "Portugués", "Alemán", "Italiano", "Mandarín", "Japonés", "Lengua de señas colombiana"];

export const BENEFITS: Record<OfferType, string[]> = {
  PRACTICA: ["Apoyo de sostenimiento", "Afiliación a ARL y salud", "Horario flexible", "Trabajo remoto algunos días", "Capacitación", "Posibilidad de vinculación", "Certificado de práctica"],
  EMPLEO: ["Afiliación a seguridad social", "Auxilio de transporte", "Horario flexible", "Trabajo remoto algunos días", "Capacitación", "Bonificación por desempeño", "Alimentación", "Plan de carrera"],
  EMPLEO_PUBLICO: ["Afiliación a seguridad social", "Estabilidad laboral", "Capacitación", "Bienestar laboral", "Horario flexible"],
  FORMACION: ["Certificado", "Material de estudio", "Clases grabadas", "Acompañamiento de tutores", "Sin costo para estudiantes"],
};

const SOFT_SKILLS = ["Trabajo en equipo", "Comunicación asertiva", "Resolución de problemas", "Organización", "Aprendizaje continuo"];

// Habilidades sugeridas según el área elegida.
export const SKILL_SUGGESTIONS: Record<string, string[]> = {
  "Tecnología": ["JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "SQL", "Git", "Docker", "Pruebas de software", "Scrum"],
  "Ingeniería": ["AutoCAD", "SolidWorks", "Gestión de proyectos", "Excel avanzado", "Lean Manufacturing", "Control de calidad"],
  "Administración": ["Excel avanzado", "Gestión de proyectos", "Atención al cliente", "Planeación estratégica", "Power BI"],
  "Contabilidad y finanzas": ["NIIF", "Excel avanzado", "Análisis financiero", "Tributaria", "Power BI", "Software contable"],
  "Mercadeo y ventas": ["Marketing digital", "Redes sociales", "SEO", "Google Ads", "Ventas consultivas", "CRM"],
  "Comunicación": ["Redacción", "Fotografía", "Edición de video", "Community management", "Canva", "Locución"],
  "Recursos humanos": ["Selección de personal", "Nómina", "Seguridad y salud en el trabajo", "Bienestar laboral", "Excel"],
  "Derecho": ["Derecho laboral", "Derecho comercial", "Contratación estatal", "Redacción jurídica", "Investigación jurídica"],
  "Diseño": ["Figma", "Adobe Illustrator", "Adobe Photoshop", "Diseño UX/UI", "Branding", "Prototipado"],
  "Producción y logística": ["Inventarios", "Cadena de suministro", "ERP", "Excel avanzado", "Control de calidad"],
  "Ambiental": ["Gestión ambiental", "ISO 14001", "Sistemas de información geográfica", "Muestreo", "Normativa ambiental"],
  "Salud": ["Atención al paciente", "Primeros auxilios", "Historia clínica", "Bioseguridad"],
  "Educación": ["Planeación de clases", "Pedagogía", "Evaluación del aprendizaje", "Herramientas digitales"],
  "Turismo y hotelería": ["Atención al cliente", "Reservas", "Inglés conversacional", "Organización de eventos"],
  "Ciencias sociales": ["Investigación social", "Análisis de datos", "Trabajo comunitario", "Redacción de informes"],
};
export const suggestedSkills = (area: string): string[] => [...(SKILL_SUGGESTIONS[area] ?? []), ...SOFT_SKILLS];

export const DURATION_SUGGESTIONS: Record<OfferType, string[]> = {
  PRACTICA: ["3 meses", "6 meses", "12 meses"],
  EMPLEO: ["Indefinida", "Término fijo de 6 meses", "Término fijo de 12 meses", "Por obra o labor"],
  EMPLEO_PUBLICO: ["Carrera administrativa", "Provisional", "Término fijo de 12 meses"],
  FORMACION: ["4 semanas", "8 semanas", "3 meses", "6 meses"],
};

export const SCHEDULE_SUGGESTIONS = ["Lunes a viernes, 8:00 a. m. a 5:00 p. m.", "Lunes a viernes, medio tiempo", "Sábados", "Horario a convenir"];

// Títulos sugeridos según el tipo y el área.
export function titleSuggestions(type: OfferType, area: string): string[] {
  const subject = area ? area.toLowerCase() : "tu área";
  switch (type) {
    case "PRACTICA":
      return [`Practicante de ${subject}`, `Practicante profesional en ${subject}`];
    case "FORMACION":
      return [`Curso de ${subject}`, `Diplomado en ${subject}`, `Taller práctico de ${subject}`];
    default:
      return [`Analista de ${subject}`, `Auxiliar de ${subject}`, `Profesional de ${subject}`];
  }
}

// Plantilla de la descripción según el tipo. Sus encabezados no cuentan como
// contenido al validar (offerForm.model.ts).
export const DESCRIPTION_TEMPLATES: Record<OfferType, string[]> = {
  PRACTICA: ["Responsabilidades:", "Lo que aprenderás:", "Lo que ofrecemos:"],
  EMPLEO: ["Responsabilidades:", "Perfil que buscamos:", "Lo que ofrecemos:"],
  EMPLEO_PUBLICO: ["Funciones del cargo:", "Perfil requerido:", "Condiciones de la vinculación:"],
  FORMACION: ["Contenido del programa:", "Dirigido a:", "Metodología y certificación:"],
};
export const descriptionTemplate = (type: OfferType) => DESCRIPTION_TEMPLATES[type].map((heading) => `${heading}\n- `).join("\n\n");
