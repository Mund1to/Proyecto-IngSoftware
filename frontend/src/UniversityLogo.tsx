import sipuLogo from "../imports/sipu-logo.png";

type Props = {
  className?: string;
  decorative?: boolean;
};

export default function UniversityLogo({ className = "", decorative = false }: Props) {
  return (
    <img
      className={`unibague-logo ${className}`}
      src={sipuLogo}
      alt={decorative ? "" : "SIPU"}
      aria-hidden={decorative || undefined}
    />
  );
}
