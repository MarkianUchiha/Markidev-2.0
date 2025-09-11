# Instrucciones para el Asistente Gemini

## Reglas Generales

- Siempre debes consultar este documento antes de realizar cualquier cambio y/o de generar una respuesta.
- Debes consultar la documentacion oficial de las tecnologias que usa el proyecto antes de implementar cualquier cambio.
- Aplica los cambios usando las recomendaciones de la documentación en sus versiones estables.
- No agregar nuevas dependencias sin aprobación explícita.
- Evita usar codigo obsoleto, consulta la documentación oficial.
- Tus respuestas en el chat deben ser en español.
- Antes de hacer cambio lee y revisa los archivos con los que el codigo nuevo va a interactuar.

## Project Overvew

El proyecto es una landing page que hara de portfolio para un desarrollador web.
debe ser atractiva para los potenciales clientes y colaboradores.
El publico objetivo son personas no tecnicas que buscan desarrolladores web.
Toma en cuenta que esta web tambien servira a otros proyectos como una tienda, un blog y una web de suscripciones.

## Arquitectura del Directorio

- Los archivos y carpetas deben ser nombrados de manera descriptiva de su objetivo.
- la estructura de directorios debe ser clara y modular.
- Dentro de la carpeta public/ deben crearse las carpetas para que guardes los archivos multimedia de forma organizada y descriptiva.
- Los archivos multimedia deben ser nombrados de manera descriptiva.
Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

## Coding Style & Convetions

- Los comentarios deben ser claros, concisos y en español, evita usar lenguaje tecnico.
- El idioma principal para el código es español.
- La identación debe ser con tabulaciones simples.
- Las variables, constantes, funciones y clases deben nombrarse en español de forma obvia y simple.

## Testing

Aqui van los frameworks, estrategias y cobertura del testing

## Git Workflow

- Las confirmaciones (commits) deben seguir la especificación de Commits Convencionales.
- Las ramas deben ser nombradas de manera descriptiva de su objetivo.
- Los mensajes de confirmación (commit messages) deben ser claros y concisos.
- los mensajes de confirmación (commit messages) deben ser en español.

## Frontend

- Usar TypeScript en lugar de JavaScript.
- Para los estilos usa Tailwind CSS.
- No usar la directiva `@apply` de Tailwind CSS.
- Crea variables CSS para los colores y fuentes o los que tailwind recomiende.
- El proyecto debe ser mobile first.
- Priorizar la usabilidad y experiencia del usuario.

## Backend

- Aun no definido

## Dependencias

### starts a file-watching, live-reloading dev script for active development

pnpm run dev

### build the entire project, one time

pnpm run build

## Seguridad

Aqui van las reglas de seguridad del proyecto
