// Datos reales del sitio en un solo lugar: si el correo o una red cambian, se
// tocan aqui y no en cada plantilla que los repite.

export const site = {
  name: "MarkiDev",
  author: "Marco Lara",
  email: "contacto@markidev.com",
} as const;

// Solo se enlazan los perfiles que representan al negocio. El Facebook personal
// y la cuenta de X con handle ajeno a la marca quedan fuera a proposito: este
// sitio le habla a quien llega recomendado y entra a verificar, y un perfil
// personal en el pie resta credibilidad en vez de sumarla.
export const socialLinks = [
  { name: "Instagram", url: "https://www.instagram.com/marki_dev/" },
  { name: "TikTok", url: "https://www.tiktok.com/@marki_dev" },
  { name: "GitHub", url: "https://github.com/MarkianUchiha" },
] as const;

// `available` evita enlazar rutas que todavia no existen: una navegacion que
// lleva a 404 es peor que una navegacion corta. Se pone en true cuando la
// pagina se construye, y la entrada aparece sola en el menu y en el pie.
export const navigation = [
  { label: "Trabajos", href: "/trabajos", available: false },
  { label: "Blog", href: "/blog", available: false },
  { label: "Sobre mi", href: "/sobre-mi", available: false },
] as const;

export const availableNavigation = navigation.filter((item) => item.available);
