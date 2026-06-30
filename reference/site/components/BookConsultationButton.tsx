import { Link } from "@tanstack/react-router";

// Routes to the on-site booking page (no third-party scheduler).
export function BookConsultationButton({
  className = "btn-accent",
  children = "Book Consultation",
  onClick,
}: {
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link to="/book-consultation" className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
