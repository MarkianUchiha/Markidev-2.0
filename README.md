# MarkiDev Portfolio 2.0

Portfolio profesional construido con Astro, enfocado en mostrar mis proyectos y servicios como desarrollador web.

## 🚀 Tecnologías

- [Astro](https://astro.build/)
- [Tailwind CSS](https://tailwindcss.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Particles.js](https://vincentgarreau.com/particles.js/)

## ✨ Características

- Diseño moderno y responsivo
- Animaciones suaves y efectos visuales
- Colecciones de contenido para proyectos
- Formulario de contacto con integración de correo
- Optimizado para SEO
- Páginas dinámicas para cada proyecto

## 🏗️ Estructura del Proyecto

```text
/
├── public/
│   ├── favicon-32x32.png
│   ├── img/
│   │   └── [imágenes del sitio]
│   └── ico/
│       └── [iconos del sitio]
├── src/
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── Servicios.astro
│   │   ├── Trabajos.astro
│   │   ├── Exp.astro
│   │   ├── Testi.astro
│   │   ├── Contacto.astro
│   │   └── Footer.astro
│   ├── content/
│   │   └── trabajos/
│   │       └── [archivos JSON de proyectos]
│   ├── layouts/
│   │   └── Layout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   └── [slug].astro
│   └── styles/
│       └── global.css
└── package.json
```

## 🛠️ Instalación

1. Clona el repositorio:

```bash
git clone https://github.com/MarkianUchiha/Markidev-2.0.git
```

1. Instala las dependencias:

```bash
pnpm install
```

1. Inicia el servidor de desarrollo:

```bash
pnpm astro dev
```

## 📝 Uso

### Agregar un nuevo proyecto

1. Crea un nuevo archivo JSON en `src/content/trabajos/`
2. Sigue la estructura definida en `content/config.ts`
3. El proyecto se agregará automáticamente a la sección de trabajos

### Estructura del archivo de proyecto

```json
{
  "title": "Nombre del Proyecto",
  "description": "Descripción del proyecto",
  "image": "/img/proyecto.jpg",
  "tags": ["tecnología1", "tecnología2"],
  "fecha": "2024-01-15",
  "url": "https://proyecto.com",
  "cliente": "Nombre del Cliente"
}
```

### 📚 Crear nuevos posts del blog

1. Crea un nuevo archivo markdown (.md) en `src/content/blog/`
2. El nombre del archivo será la URL del post (ej: `mi-primer-post.md`)
3. Añade el frontmatter al inicio del archivo con la siguiente estructura:

```markdown
---
title: "Título del Post"
description: "Descripción corta del post para SEO y previsualizaciones"
pubDate: 2025-09-16
author: "Tu Nombre"
image: "/img/blog/imagen-principal.jpg"
tags: ["tag1", "tag2", "tag3"]
draft: false
---

# Contenido del Post

Tu contenido aquí...
```

#### Formato del contenido

- **Imágenes**: Coloca las imágenes en `/public/img/blog/` y úsalas así:

```markdown
![Descripción de la imagen](/img/blog/nombre-imagen.jpg)
```

- **Videos de YouTube**: Usa el componente iframe:

```markdown
<figure class="video">
  <iframe src="https://www.youtube.com/embed/ID_DEL_VIDEO" allowfullscreen></iframe>
</figure>
```

- **Código**: Usa bloques de código con el lenguaje especificado:

```markdown
```javascript
const ejemplo = "código aquí";
```
```

#### Mejores prácticas

1. **Imágenes**:
   - Optimiza las imágenes antes de subirlas
   - Usa nombres descriptivos
   - Imagen principal recomendada: 1200x630px
   - Imágenes del contenido: máximo 1600px de ancho

2. **Contenido**:
   - Usa encabezados (##, ###) para organizar el contenido
   - Incluye enlaces relevantes
   - Añade ejemplos de código cuando sea necesario
   - Mantén los párrafos cortos y legibles

3. **SEO**:
   - Escribe títulos descriptivos
   - Incluye palabras clave relevantes
   - Usa descripciones concisas
   - Elige tags relevantes (3-5 recomendados)

4. **Desarrollo**:
   - Prueba el post en modo desarrollo antes de publicar
   - Verifica que las imágenes se carguen correctamente
   - Comprueba los enlaces
   - Revisa la visualización en móvil y escritorio

## 🔗 Enlaces

- [Portfolio en vivo](https://markidev.com)
- [LinkedIn](https://linkedin.com/in/markiandev)
- [GitHub](https://github.com/MarkianUchiha)

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE.md](LICENSE.md) para más detalles.

## ✉️ Contacto

Para cualquier consulta o propuesta de trabajo, puedes contactarme en:

- Email: <contacto@markidev.com>

Bienvenido al repositorio de mi portafolio personal (MarkiDev 2.0). Este proyecto sirve como una carta de presentación digital, mostrando mis habilidades, experiencia y proyectos como desarrollador web. El sitio ha sido construido desde cero utilizando tecnologías modernas con un enfoque en el rendimiento y el diseño.

## 🚀 Secciones del Sitio

El portafolio es una aplicación de página única (SPA) que contiene las siguientes secciones:

- **Hero**: Una sección de bienvenida impactante con una animación de estrellas fugaces.
- **Servicios**: Describe los servicios que ofrezco.
- **Trabajos**: Una galería de mis proyectos recientes con enlaces y descripciones.
- **Experiencia Profesional**: Un acordeón interactivo que detalla mi experiencia laboral y habilidades.
- **Mis Clientes**: Un carrusel automático con testimonios de clientes.
- **Contacto**: Un formulario para que los visitantes puedan enviarme un mensaje.
- **Footer**: Un pie de página minimalista con enlaces a redes sociales y un botón para volver al inicio.

## 🛠️ Tecnologías Utilizadas

- **Framework**: [Astro](https://astro.build/) - Para un sitio web rápido y optimizado.
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/) - Para un diseño moderno y responsivo.
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/) - Para un código más robusto y mantenible.

## 🧞 Comandos Disponibles

Todos los comandos se ejecutan desde la raíz del proyecto en tu terminal. Se recomienda usar `pnpm` como gestor de paquetes.

| Comando          | Acción                                                 |
| :--------------- | :----------------------------------------------------- |
| `pnpm install`   | Instala todas las dependencias del proyecto.           |
| `pnpm astro dev`   | Inicia un servidor de desarrollo local en `localhost:4321`. |
| `pnpm astro build` | Compila el sitio para producción en la carpeta `./dist/`. |
| `pnpm astro preview` | Previsualiza la compilación de producción localmente.  |

## 📁 Estructura del Proyecto

La estructura principal del código se organiza de la siguiente manera:

```text
/
├── public/              # Contiene todos los assets estáticos (imágenes, iconos).
├── src/
│   ├── components/      # Contiene todos los componentes de Astro reutilizables (Hero, Footer, etc.).
│   ├── layouts/         # Contiene las plantillas de página, como el Layout principal.
│   ├── pages/           # Contiene las páginas del sitio (index.astro).
│   └── styles/          # Contiene los estilos globales.
└── package.json         # Define las dependencias y scripts del proyecto.
```

Gracias por visitar mi proyecto.
