// Vista previa en vivo: la oferta como la verá el candidato en el catálogo.
import TypeBadge from "../TypeBadge";
import { IconCalendar, IconMonitor, IconPin, IconUser, IconVerified } from "../../../shared/ui/icons";
import { experienceLabel, offerSalaryLabel, workScheduleLabel } from "../offers.model";
import { digitsOnly, meaningfulDescription, type OfferDraft } from "./offerForm.model";
import { formatDate } from "../../../shared/lib/format";

type Props = { draft: OfferDraft; company: string; verified: boolean };

export default function OfferPreview({ draft, company, verified }: Props) {
  const salary = draft.offerType === "PRACTICA" && !draft.paid
    ? "Sin apoyo económico"
    : offerSalaryLabel(draft.offerType, digitsOnly(draft.salary), digitsOnly(draft.salaryMax));
  const description = meaningfulDescription(draft.description);
  const schedule = workScheduleLabel(draft.workSchedule);
  const experience = draft.offerType === "FORMACION" ? null : experienceLabel(draft.experience);

  return (
    <article className="offer-preview panel-card" aria-label="Vista previa de la oferta">
      <div className="offer-preview-top">
        <TypeBadge type={draft.offerType} />
        {draft.vacancies > 1 && <span className="offer-preview-vacancies">{draft.vacancies} vacantes</span>}
      </div>
      <div className="offer-preview-head">
        <span className="offer-preview-mark" aria-hidden="true">{company.slice(0, 2).toUpperCase()}</span>
        <div>
          <h3>{draft.title.trim() || <span className="offer-preview-placeholder">Título de la oferta</span>}</h3>
          <p>{company}{verified && <IconVerified size={15} />}</p>
        </div>
      </div>
      <ul className="offer-preview-chips">
        <li><IconPin size={14} />{draft.city || "Ciudad"}</li>
        <li><IconMonitor size={14} />{draft.modality}</li>
        {draft.area && <li>{draft.area}</li>}
        {schedule && <li>{schedule}</li>}
        {experience && <li><IconUser size={14} />{experience}</li>}
      </ul>
      <p className="offer-preview-text">{description ? (description.length > 160 ? `${description.slice(0, 160)}…` : description) : "Aquí aparecerá el inicio de la descripción."}</p>
      {draft.skills.length > 0 && (
        <ul className="offer-preview-skills" aria-label="Habilidades">
          {draft.skills.slice(0, 6).map((skill) => <li key={skill}>{skill}</li>)}
          {draft.skills.length > 6 && <li>+{draft.skills.length - 6}</li>}
        </ul>
      )}
      <div className="offer-preview-foot">
        <span><small>Remuneración</small><strong>{salary}</strong></span>
        <span><small><IconCalendar size={13} /> Cierre</small><strong>{draft.closeDate ? formatDate(`${draft.closeDate}T12:00:00Z`) : "Sin fecha"}</strong></span>
      </div>
    </article>
  );
}
