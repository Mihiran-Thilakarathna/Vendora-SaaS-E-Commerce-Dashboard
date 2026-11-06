/**
 * Small in-app loading spinner: a thick lime arc with a fading tail and a rounded head.
 * Used for loading inside the app (switching pages). The full-screen BrandLoader is
 * reserved for first load and the sign-in / demo / create-store moments.
 */
const Spinner = ({ size = 40, label = "Loading", className = "" }) => (
  <span
    role="status"
    aria-label={label}
    className={`v-spinner ${className}`}
    style={{ width: size, height: size, "--v-spinner-w": `${Math.max(3, Math.round(size * 0.14))}px` }}
  />
);

/** Centred spinner for a page area while its content loads. */
export const PageSpinner = ({ label = "Loading" }) => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <Spinner size={40} label={label} />
  </div>
);

export default Spinner;
