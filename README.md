# MarkiDev 2.0 - Portfolio

Este es el repositorio del código fuente de mi portafolio personal, desarrollado con [Astro](https://astro.build/).

## 🚀 Estructura del Proyecto

La estructura del proyecto es la siguiente:

```text
/
├── public/
│   ├── ico/
│   │   ├── bd.png
│   │   ├── ia.png
│   │   └── pc.png
│   ├── img/
│   │   └── code.png
│   └── favicon.svg
├── src/
│   ├── assets/
│   │   ├── astro.svg
│   │   └── background.svg
│   ├── components/
│   │   ├── Hero.astro
│   │   └── Servicios.astro
│   ├── layouts/
│   │   └── Layout.astro
│   ├── pages/
│   │   └── index.astro
│   └── styles/
│       └── global.css
└── package.json
```

## 🧞 Comandos

Todos los comandos se ejecutan desde la raíz del proyecto, en una terminal:

| Comando | Acción |
| :--- | :--- |
| `pnpm install` | Instala las dependencias. |
| `pnpm astro dev` | Inicia el servidor de desarrollo local en `localhost:4321`. |
| `pnpm run build` | Compila el sitio de producción en `./dist/`. |
| `pnpm run preview`| Previsualiza la compilación localmente, antes de desplegar. |

## 🛠️ Tecnologías Utilizadas

*   [Astro](https://astro.build/)
*   [Tailwind CSS](https://tailwindcss.com/)

## 🧩 Componentes

*   `Hero.astro`: El componente principal que muestra el encabezado de la página.
*   `Servicios.astro`: Un componente que muestra los servicios que ofrezco.