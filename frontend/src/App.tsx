import { useEffect, useState } from "react";
import { api, type ApiUser } from "./lib/api";
import AuthScreen from "./screens/AuthScreen";
import StudentDashboard from "./screens/StudentDashboard";
import OfferDetail from "./screens/OfferDetail";
import StudentProfile from "./screens/StudentProfile";
import StudentApplications from "./screens/StudentApplications";
import CompanyDashboard from "./screens/CompanyDashboard";
import CompanyApplicants from "./screens/CompanyApplicants";
import CompanyVerification from "./screens/CompanyVerification";
import Convocatorias from "./screens/Convocatorias";
import EmploymentStats from "./screens/EmploymentStats";
import ExternalDashboard from "./screens/ExternalDashboard";
import ExternalJobDetail from "./screens/ExternalJobDetail";
import ExternalProfile from "./screens/ExternalProfile";
import ExternalApplications from "./screens/ExternalApplications";

export type Role = "student" | "company" | "external";

export type Screen =
  | "auth"
  | "student-dashboard"
  | "offer-detail"
  | "student-profile"
  | "student-applications"
  | "company-dashboard"
  | "company-applicants"
  | "company-verification"
  | "convocatorias"
  | "employment-stats"
  | "external-dashboard"
  | "external-job-detail"
  | "external-profile"
  | "external-applications";

export type UserSession = {
  id: number;
  email: string;
  nombreCompleto: string;
  telefono?: string | null;
  universidad?: string | null;
  programaAcademico?: string | null;
  semestre?: number | string | null;
  codigoEstudiante?: string | null;
  fechaGraduacionEstimada?: string | null;
  resumen?: string | null;
  ubicacion?: string | null;
  disponibilidad?: string | null;
  cvUrl?: string | null;
  organizacionNombre?: string | null;
  organizacionVerificada?: boolean;
  profileTypes: string[];
  roles: string[];
};

// ── Internship offers (for students) ────────────────────────────────────────

export type Offer = {
  id: number;
  title: string;
  company: string;
  logo: string;
  city: string;
  area: string;
  modality: "Presencial" | "Remota" | "Híbrida";
  closeDate: string;
  salary: string;
  description: string;
  requirements: string[];
  applicants?: number;
  offerType?: "PRACTICA" | "EMPLEO" | "EMPLEO_PUBLICO";
  status?: string;
  verified?: boolean;
  duration?: string | null;
  schedule?: string | null;
  contactEmail?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
};

export const OFFERS: Offer[] = [
  {
    id: 1,
    title: "Practicante de Ingeniería de Software",
    company: "Bancolombia",
    logo: "B",
    city: "Bogotá",
    area: "Tecnología",
    modality: "Híbrida",
    closeDate: "2026-10-15",
    salary: "$1.200.000/mes",
    description:
      "Buscamos un practicante apasionado por el desarrollo de software para unirse a nuestro equipo de tecnología. Trabajarás en proyectos reales de transformación digital, colaborando con equipos ágiles en la creación de soluciones financieras de alto impacto.",
    requirements: [
      "Estudiante de Ingeniería de Sistemas, Software o afines",
      "Conocimientos en Java, Python o JavaScript",
      "Manejo de bases de datos SQL",
      "Inglés B1 o superior",
      "Disponibilidad para práctica de 6 meses",
    ],
    applicants: 34,
  },
  {
    id: 2,
    title: "Practicante de Marketing Digital",
    company: "Grupo Éxito",
    logo: "E",
    city: "Medellín",
    area: "Marketing",
    modality: "Presencial",
    closeDate: "2026-09-28",
    salary: "$900.000/mes",
    description:
      "Únete al equipo de Marketing Digital del Grupo Éxito. Aprenderás sobre estrategia digital, gestión de redes sociales, análisis de métricas y campañas de publicidad en plataformas como Meta Ads y Google Ads.",
    requirements: [
      "Estudiante de Marketing, Comunicación o Publicidad",
      "Conocimiento en redes sociales y contenido digital",
      "Manejo de herramientas como Canva o Adobe",
      "Creatividad y habilidades de comunicación",
    ],
    applicants: 21,
  },
  {
    id: 3,
    title: "Practicante de Contabilidad y Finanzas",
    company: "Deloitte Colombia",
    logo: "D",
    city: "Bogotá",
    area: "Contabilidad",
    modality: "Presencial",
    closeDate: "2026-10-05",
    salary: "$1.100.000/mes",
    description:
      "Deloitte busca practicantes de contabilidad para apoyar el equipo de auditoría. Participarás en revisiones de estados financieros, análisis de riesgos y elaboración de informes para clientes corporativos de alto perfil.",
    requirements: [
      "Estudiante de Contaduría Pública o Finanzas",
      "Conocimiento en NIIF y normativa contable colombiana",
      "Manejo de Excel avanzado",
      "Capacidad analítica y atención al detalle",
    ],
    applicants: 18,
  },
  {
    id: 4,
    title: "Practicante de Recursos Humanos",
    company: "Avianca",
    logo: "A",
    city: "Bogotá",
    area: "Recursos Humanos",
    modality: "Híbrida",
    closeDate: "2026-10-20",
    salary: "$950.000/mes",
    description:
      "Apoya al equipo de Talento Humano de Avianca en procesos de selección, onboarding y bienestar corporativo.",
    requirements: [
      "Estudiante de Psicología, Administración o RRHH",
      "Habilidades de comunicación interpersonal",
      "Manejo de herramientas ofimáticas",
      "Actitud de servicio y trabajo en equipo",
    ],
    applicants: 29,
  },
  {
    id: 5,
    title: "Practicante de Diseño UX/UI",
    company: "Rappi",
    logo: "R",
    city: "Bogotá",
    area: "Tecnología",
    modality: "Remota",
    closeDate: "2026-11-01",
    salary: "$1.050.000/mes",
    description:
      "En Rappi buscamos un practicante de diseño con hambre de crear experiencias memorables para millones de usuarios en Latinoamérica.",
    requirements: [
      "Estudiante de Diseño Gráfico, Industrial o carreras afines",
      "Manejo de Figma o Sketch",
      "Portafolio de proyectos de diseño",
      "Comprensión de principios UX y accesibilidad",
    ],
    applicants: 47,
  },
  {
    id: 6,
    title: "Practicante de Ingeniería Industrial",
    company: "Alpina Productos Alimenticios",
    logo: "AL",
    city: "Sopó, Cundinamarca",
    area: "Producción",
    modality: "Presencial",
    closeDate: "2026-09-30",
    salary: "$1.000.000/mes",
    description:
      "Alpina busca practicantes de Ingeniería Industrial para apoyar procesos de mejora continua y optimización de cadena de suministro.",
    requirements: [
      "Estudiante de Ingeniería Industrial o de Producción",
      "Conocimientos en Lean Manufacturing o Six Sigma básico",
      "Manejo de Excel y herramientas de análisis de datos",
      "Disponibilidad para trabajo en planta",
    ],
    applicants: 12,
  },
];

// ── Public job listings (for external users) ─────────────────────────────────

export type JobType = "Práctica" | "Tiempo completo" | "Medio tiempo" | "Contrato" | "Freelance";

export type Job = {
  id: number;
  title: string;
  company: string;
  logo: string;
  city: string;
  area: string;
  modality: "Presencial" | "Remota" | "Híbrida";
  type: JobType;
  closeDate: string;
  salaryMin: number;
  salaryMax: number;
  experience: string;
  description: string;
  requirements: string[];
  benefits: string[];
  applicants: number;
};

export const JOBS: Job[] = [
  {
    id: 101,
    title: "Desarrollador Full Stack Senior",
    company: "Bancolombia",
    logo: "B",
    city: "Bogotá",
    area: "Tecnología",
    modality: "Híbrida",
    type: "Tiempo completo",
    closeDate: "2026-10-30",
    salaryMin: 6000000,
    salaryMax: 9000000,
    experience: "3+ años",
    description:
      "Bancolombia busca un Desarrollador Full Stack Senior para liderar la construcción de soluciones digitales en nuestra plataforma de banca en línea. Trabajarás con microservicios, APIs REST y arquitecturas en la nube para millones de usuarios.",
    requirements: [
      "Profesional en Ingeniería de Sistemas o afines",
      "3+ años de experiencia con React y Node.js o Spring Boot",
      "Experiencia con AWS o Azure",
      "Manejo de bases de datos SQL y NoSQL",
      "Inglés B2 o superior",
    ],
    benefits: ["Seguro de vida y salud complementaria", "Bono de desempeño anual", "Trabajo híbrido 3x2", "Auxilio educativo"],
    applicants: 89,
  },
  {
    id: 102,
    title: "Analista de Marketing Digital",
    company: "Grupo Éxito",
    logo: "E",
    city: "Medellín",
    area: "Marketing",
    modality: "Presencial",
    type: "Tiempo completo",
    closeDate: "2026-10-12",
    salaryMin: 3500000,
    salaryMax: 5000000,
    experience: "1–3 años",
    description:
      "Grupo Éxito busca un Analista de Marketing Digital para gestionar campañas omnicanal, analizar métricas de rendimiento y ejecutar estrategias de crecimiento en e-commerce.",
    requirements: [
      "Profesional en Marketing, Publicidad o Comunicación",
      "Experiencia en Meta Ads, Google Ads y SEO",
      "Dominio de Google Analytics 4 y Looker Studio",
      "Orientación a resultados y pensamiento analítico",
    ],
    benefits: ["Descuento empleado en todas las cadenas", "Auxilio de alimentación", "Plan de carrera"],
    applicants: 43,
  },
  {
    id: 103,
    title: "Contador Público Senior",
    company: "Deloitte Colombia",
    logo: "D",
    city: "Bogotá",
    area: "Contabilidad",
    modality: "Presencial",
    type: "Tiempo completo",
    closeDate: "2026-10-08",
    salaryMin: 5500000,
    salaryMax: 7500000,
    experience: "4+ años",
    description:
      "Deloitte Colombia requiere un Contador Senior con experiencia en auditoría financiera para liderar equipos y gestionar clientes del sector financiero y retail.",
    requirements: [
      "Contador Público titulado con tarjeta profesional",
      "4+ años en auditoría o revisoría fiscal",
      "Dominio de NIIF e IFRS",
      "Experiencia en Big 4 es un plus",
      "Inglés B2",
    ],
    benefits: ["Bonificación por desempeño", "Plan de carrera internacional", "Seguro médico premium"],
    applicants: 27,
  },
  {
    id: 104,
    title: "Coordinador de Talento Humano",
    company: "Avianca",
    logo: "A",
    city: "Bogotá",
    area: "Recursos Humanos",
    modality: "Presencial",
    type: "Tiempo completo",
    closeDate: "2026-11-05",
    salaryMin: 4000000,
    salaryMax: 6000000,
    experience: "2–4 años",
    description:
      "Avianca busca un Coordinador de RRHH para liderar procesos de selección, onboarding, gestión del clima organizacional y programas de bienestar para nuestro equipo de tierra.",
    requirements: [
      "Profesional en Psicología, Administración o RRHH",
      "2+ años en roles similares",
      "Conocimiento en software HRIS (SAP SuccessFactors preferible)",
      "Habilidades de liderazgo y negociación",
    ],
    benefits: ["Tiquetes aéreos con descuento", "Seguro de vida colectivo", "Auxilio educativo"],
    applicants: 56,
  },
  {
    id: 105,
    title: "Product Designer UX/UI",
    company: "Rappi",
    logo: "R",
    city: "Bogotá",
    area: "Tecnología",
    modality: "Remota",
    type: "Tiempo completo",
    closeDate: "2026-11-15",
    salaryMin: 5000000,
    salaryMax: 8000000,
    experience: "2+ años",
    description:
      "Rappi busca un Product Designer apasionado por crear experiencias que impactan a millones de usuarios. Trabajarás en squads autónomos de producto diseñando flujos end-to-end.",
    requirements: [
      "Portafolio de proyectos digitales con foco en UX",
      "Dominio avanzado de Figma",
      "Experiencia en Design Systems",
      "Inglés conversacional para colaboración con equipos regionales",
    ],
    benefits: ["100% remoto", "Stock options", "Budget de formación anual", "Home office allowance"],
    applicants: 112,
  },
  {
    id: 106,
    title: "Ingeniero de Procesos",
    company: "Alpina Productos Alimenticios",
    logo: "AL",
    city: "Sopó, Cundinamarca",
    area: "Producción",
    modality: "Presencial",
    type: "Tiempo completo",
    closeDate: "2026-10-20",
    salaryMin: 4500000,
    salaryMax: 6500000,
    experience: "2–5 años",
    description:
      "Alpina requiere un Ingeniero de Procesos para optimizar las líneas de producción, implementar metodologías de mejora continua y garantizar los estándares de calidad en planta.",
    requirements: [
      "Ingeniero Industrial, de Alimentos o Mecánico",
      "Experiencia en manufactura de alimentos o consumo masivo",
      "Conocimientos en Lean Six Sigma (certificación deseable)",
      "Manejo de SAP PM o similar",
    ],
    benefits: ["Transporte desde Bogotá", "Casino empresarial", "Prima extralegale", "Plan de carrera"],
    applicants: 34,
  },
  {
    id: 107,
    title: "Abogado Corporativo Junior",
    company: "Claro Colombia",
    logo: "CL",
    city: "Bogotá",
    area: "Jurídica",
    modality: "Híbrida",
    type: "Tiempo completo",
    closeDate: "2026-10-25",
    salaryMin: 3800000,
    salaryMax: 5500000,
    experience: "1–3 años",
    description:
      "Claro Colombia busca un Abogado Corporativo Junior para apoyar la revisión de contratos comerciales, asesoría regulatoria en telecomunicaciones y gestión de litigios menores.",
    requirements: [
      "Abogado titulado con tarjeta profesional",
      "Conocimientos en derecho comercial y contratos",
      "Inglés B1 mínimo",
      "Atención al detalle y redacción jurídica impecable",
    ],
    benefits: ["Planes de telefonía e internet gratuitos", "Auxilio educativo", "Fondo de empleados"],
    applicants: 19,
  },
  {
    id: 108,
    title: "Diseñador Gráfico Freelance",
    company: "Agencia Naranja",
    logo: "AN",
    city: "Cali",
    area: "Diseño",
    modality: "Remota",
    type: "Freelance",
    closeDate: "2026-10-10",
    salaryMin: 2500000,
    salaryMax: 4000000,
    experience: "1+ años",
    description:
      "Agencia Naranja busca un diseñador gráfico freelance para apoyar proyectos de branding, materiales de campaña y piezas para redes sociales de clientes en el sector retail.",
    requirements: [
      "Portafolio en branding, ilustración o diseño editorial",
      "Dominio de Adobe Creative Suite (Illustrator, Photoshop, InDesign)",
      "Capacidad de entregar en tiempos ajustados",
      "Conocimiento en Motion Graphics es un plus",
    ],
    benefits: ["Horarios flexibles", "Proyectos variados", "Pago puntual quincenal"],
    applicants: 61,
  },
];

// ── Internship applications ───────────────────────────────────────────────────

export type Application = {
  id: number;
  offerId: number;
  offerTitle: string;
  company: string;
  appliedDate: string;
  status: "Enviada" | "En revisión" | "Aceptada" | "Rechazada";
};

export type JobApplication = {
  id: number;
  jobId: number;
  jobTitle: string;
  company: string;
  appliedDate: string;
  status: "Enviada" | "En revisión" | "Entrevista" | "Aceptada" | "Rechazada";
};

const profileTypeToRole = (profileType?: string): Role => {
  if (profileType === "ORGANIZACION") return "company";
  if (profileType === "CANDIDATO_EXTERNO") return "external";
  return "student";
};

const mapUserToSession = (user: ApiUser): UserSession => {
  const studentProfile = user.perfiles?.find((profile) => profile.tipo === "ESTUDIANTE");
  const externalProfile = user.perfiles?.find((profile) => profile.tipo === "CANDIDATO_EXTERNO");
  const organizationProfile = user.perfiles?.find((profile) => profile.tipo === "ORGANIZACION");
  return {
    id: Number(user.id),
    email: user.email,
    nombreCompleto: user.nombreCompleto,
    telefono: user.telefono,
    universidad: studentProfile?.universidad,
    programaAcademico: studentProfile?.programaAcademico,
    semestre: studentProfile?.semestre,
    codigoEstudiante: studentProfile?.codigoEstudiante,
    fechaGraduacionEstimada: studentProfile?.fechaGraduacionEstimada,
    resumen: externalProfile?.resumen,
    ubicacion: externalProfile?.ubicacion,
    disponibilidad: externalProfile?.disponibilidad,
    cvUrl: externalProfile?.cvUrl,
    organizacionNombre: organizationProfile?.razonSocial,
    organizacionVerificada: organizationProfile?.verificada,
    profileTypes: user.profileTypes ?? user.perfiles?.map((profile) => profile.tipo ?? "ESTUDIANTE") ?? ["ESTUDIANTE"],
    roles: user.roles ?? ["USUARIO"],
  };
};

export type AppState = {
  screen: Screen;
  role: Role | null;
  token: string | null;
  currentUser: UserSession | null;
  selectedOffer: Offer | null;
  selectedJob: Job | null;
  selectedCompanyOffer: Offer | null;
  applicantFilter?: "Todos" | "En revisión" | "Aceptada" | "Rechazada";
  applications: Application[];
  jobApplications: JobApplication[];
};

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const storedToken = localStorage.getItem("sipu-token");
    const storedUser = localStorage.getItem("sipu-user");
    return {
      screen: "auth",
      role: null,
      token: storedToken,
      currentUser: storedUser ? JSON.parse(storedUser) as UserSession : null,
      selectedOffer: null,
      selectedJob: null,
      selectedCompanyOffer: null,
      applications: [],
      jobApplications: [],
    };
  });

  useEffect(() => {
    if (state.token) {
      localStorage.setItem("sipu-token", state.token);
    } else {
      localStorage.removeItem("sipu-token");
    }
  }, [state.token]);

  useEffect(() => {
    if (state.currentUser) {
      localStorage.setItem("sipu-user", JSON.stringify(state.currentUser));
    } else {
      localStorage.removeItem("sipu-user");
    }
  }, [state.currentUser]);

  useEffect(() => {
    if (!state.token) return;

    api.getCurrentUser(state.token)
      .then((data) => {
        const user = mapUserToSession(data.user);
        const nextRole = profileTypeToRole(user.profileTypes[0]);
        setState((current) => ({
          ...current,
          currentUser: user,
          role: nextRole,
          screen: nextRole === "company" ? "company-dashboard" : nextRole === "external" ? "external-dashboard" : "student-dashboard",
        }));
      })
      .catch(() => {
        setState((current) => ({ ...current, token: null, currentUser: null, role: null, screen: "auth" }));
      });
  }, [state.token]);

  useEffect(() => {
    if (!state.token) return;

    api.getMyApplications(state.token)
      .then((response) => {
        const applications = (response.applications ?? []).map((item) => {
          let status: Application["status"] = "Enviada";
          if (item.estado === "EN_REVISION" || item.estado === "PRESELECCIONADA") status = "En revisión";
          else if (item.estado === "ACEPTADA") status = "Aceptada";
          else if (item.estado === "RECHAZADA") status = "Rechazada";

          return {
            id: Number(item.id),
            offerId: Number(item.oferta_id),
            offerTitle: item.oferta_titulo ?? "Oferta",
            company: item.empresa ?? "Empresa",
            appliedDate: (item.created_at ?? new Date().toISOString()).slice(0, 10),
            status,
            type: item.oferta_tipo,
          };
        });
        const practiceApplications: Application[] = applications
          .filter((item) => item.type === "PRACTICA")
          .map(({ type: _type, ...application }) => application);
        const jobApplications: JobApplication[] = applications
          .filter((item) => item.type !== "PRACTICA")
          .map((item) => ({
            id: item.id,
            jobId: item.offerId,
            jobTitle: item.offerTitle,
            company: item.company,
            appliedDate: item.appliedDate,
            status: item.status,
          }));

        setState((current) => ({ ...current, applications: practiceApplications, jobApplications }));
      })
      .catch((error) => console.error("getMyApplications failed:", error));
  }, [state.token]);

  const navigate = (screen: Screen, extra?: Partial<AppState>) => {
    setState((s) => ({ ...s, screen, ...extra }));
    window.scrollTo({ top: 0 });
  };

  const login = async (email: string, password: string) => {
    const response = await api.login({ email, password });
    const user = mapUserToSession(response.user);
    const nextRole = profileTypeToRole(user.profileTypes[0]);

    setState((current) => ({
      ...current,
      token: response.token,
      currentUser: user,
      role: nextRole,
      screen: nextRole === "company" ? "company-dashboard" : nextRole === "external" ? "external-dashboard" : "student-dashboard",
      applications: [],
      jobApplications: [],
    }));
  };

  const register = async (payload: Record<string, unknown>) => {
    const response = await api.register(payload);
    const user = mapUserToSession(response.user);
    const nextRole = profileTypeToRole(user.profileTypes[0]);

    setState((current) => ({
      ...current,
      token: response.token,
      currentUser: user,
      role: nextRole,
      screen: nextRole === "company" ? "company-dashboard" : nextRole === "external" ? "external-dashboard" : "student-dashboard",
      applications: [],
      jobApplications: [],
    }));
  };

  const updateExternalProfile = async (payload: Record<string, unknown>) => {
    if (!state.token) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");

    try {
      const response = await api.updateExternalProfile(payload, state.token);
      setState((current) => ({
        ...current,
        currentUser: mapUserToSession(response.user),
      }));
    } catch (error) {
      console.error("updateExternalProfile failed:", error);
      throw error;
    }
  };

  const updateStudentProfile = async (payload: Record<string, unknown>) => {
    if (!state.token) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");

    await api.updateCurrentUser({ nombreCompleto: payload.nombreCompleto, telefono: payload.telefono }, state.token);
    const response = await api.updateStudentProfile({
      universidad: payload.universidad,
      programaAcademico: payload.programaAcademico,
      semestre: payload.semestre,
      codigoEstudiante: payload.codigoEstudiante,
      fechaGraduacionEstimada: payload.fechaGraduacionEstimada,
    }, state.token);
    setState((current) => ({ ...current, currentUser: mapUserToSession(response.user) }));
  };

  const logout = () => {
    setState((current) => ({
      ...current,
      token: null,
      currentUser: null,
      role: null,
      screen: "auth",
      applications: [],
      jobApplications: [],
    }));
  };

  const applyToOffer = async (offer: Offer) => {
    if (!state.token) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    if (state.applications.find((a) => a.offerId === offer.id)) return;

    try {
      const response = await api.applyToOffer(String(offer.id), state.token, { cartaPresentacion: `Postulación a ${offer.title}` });
      const createdApp = response.application;

      setState((s) => ({
        ...s,
        applications: [
          {
            id: Number(createdApp?.id ?? Date.now()),
            offerId: Number(offer.id),
            offerTitle: offer.title,
            company: offer.company,
            appliedDate: new Date().toISOString().slice(0, 10),
            status: "Enviada",
          },
          ...s.applications,
        ],
      }));
    } catch (error) {
      console.error("applyToOffer failed:", error);
      throw error;
    }
  };

  const applyToJob = async (job: Job) => {
    if (!state.token) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    if (state.jobApplications.find((a) => a.jobId === job.id)) return;

    try {
      await api.applyToOffer(String(job.id), state.token, { cartaPresentacion: `Postulación a ${job.title}` });
      setState((s) => ({
        ...s,
        jobApplications: [
          { id: Date.now(), jobId: job.id, jobTitle: job.title, company: job.company, appliedDate: new Date().toISOString().slice(0, 10), status: "Enviada" },
          ...s.jobApplications,
        ],
      }));
    } catch (error) {
      console.error("applyToJob failed:", error);
      throw error;
    }
  };

  const updateCandidateStatus = async (id: number, status: "Aceptada" | "Rechazada") => {
    if (!state.token) return;

    try {
      await api.updateApplicationStatus(id, status === "Aceptada" ? "ACEPTADA" : "RECHAZADA", state.token);
    } catch (error) {
      console.error("updateCandidateStatus failed:", error);
      throw error;
    }
  };

  const props = { state, navigate, applyToOffer, applyToJob, updateCandidateStatus, updateExternalProfile, updateStudentProfile, login, register, logout };

  switch (state.screen) {
    case "auth":               return <AuthScreen {...props} />;
    case "student-dashboard":  return <StudentDashboard {...props} />;
    case "offer-detail":       return <OfferDetail {...props} />;
    case "student-profile":    return <StudentProfile {...props} />;
    case "student-applications": return <StudentApplications {...props} />;
    case "company-dashboard":  return <CompanyDashboard {...props} />;
    case "company-applicants": return <CompanyApplicants {...props} />;
    case "company-verification": return <CompanyVerification {...props} />;
    case "convocatorias":      return <Convocatorias {...props} />;
    case "employment-stats":   return <EmploymentStats {...props} />;
    case "external-dashboard": return <ExternalDashboard {...props} />;
    case "external-job-detail":return <ExternalJobDetail {...props} />;
    case "external-profile":   return <ExternalProfile {...props} />;
    case "external-applications": return <ExternalApplications {...props} />;
    default:                   return <AuthScreen {...props} />;
  }
}
