// Dates on the site, always in Argentina's time: "23 de noviembre de 2026".
const long = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })

export const longDate = (d: Date | string) => long.format(new Date(d))
