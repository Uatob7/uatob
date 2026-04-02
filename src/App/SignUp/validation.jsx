/**
 * Returns an errors object for the given step.
 * Empty object = valid.
 */
export function validate(step, { accountData, contactData, vehicleData }) {
  const e = {};

  if (step === 1) {
    if (!accountData.firstName.trim()) e.firstName = "Required";
    if (!accountData.lastName.trim())  e.lastName  = "Required";
    if (!accountData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      e.email = "Enter a valid email address";
    if (accountData.password.length < 8)
      e.password = "Password must be at least 8 characters";
    if (accountData.password !== accountData.confirmPassword)
      e.confirmPassword = "Passwords don't match";
    if (!accountData.terms)
      e.terms = "You must agree to continue";
  }

  if (step === 2) {
    if (!contactData.phone.trim())   e.phone   = "Required";
    if (!contactData.address.trim()) e.address = "Required";
    if (!contactData.city.trim())    e.city    = "Required";
    if (!contactData.zip.match(/^\d{5}(-\d{4})?$/))
      e.zip = "Enter a valid ZIP code";
  }

  if (step === 3) {
    if (!vehicleData.model.trim()) e.model = "Required";
    if (!vehicleData.year || vehicleData.year < 2005 || vehicleData.year > 2025)
      e.year = "Enter a year between 2005–2025";
    if (!vehicleData.color.trim()) e.color = "Required";
    if (!vehicleData.plate.trim()) e.plate = "Required";
    if (!vehicleData.rideTypes?.length)
      e.rideTypes = "Select at least one ride type";
  }

  return e;
}