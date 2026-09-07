// Datos reales del sitio en un solo lugar: si el correo o una red cambian, se
// tocan aqui y no en cada plantilla que los repite.

// Se escribe una sola vez: el enlace de WhatsApp lo exige pegado y con el 52
// del pais, pero a un mexicano se le ensena agrupado. Derivar uno del otro evita
// que al cambiar de numero se actualice solo la mitad.
const whatsappNumber = "6181121871";

export const site = {
  name: "MarkiDev",
  author: "Marco Lara",
  email: "contacto@markidev.com",
  whatsapp: {
    display: "618 112 1871",
    url: `https://wa.me/52${whatsappNumber}`,
  },
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

// Una seccion se enlaza solo cuando tiene algo que enseñar. Las que dependen de
// una coleccion se anuncian con `collection` y el menu las muestra sola cuando
// existe la primera entrada publicada; las demas llevan `available` a mano.
// Enlazar una seccion vacia es peor que no enlazarla: el cliente que entra a
// verificar encuentra el hueco.
export const navigation = [
  { label: "Trabajos", href: "/trabajos/", collection: "work" },
  { label: "Blog", href: "/blog/", collection: "blog" },
  { label: "Sobre mi", href: "/sobre-mi/", available: false },
] as const;
