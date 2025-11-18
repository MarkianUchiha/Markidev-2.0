// scripts/gemini-onboarding.js

import fs from 'fs/promises';
import path from 'path';

/**
 * Este script está diseñado para ser ejecutado por el asistente de IA (Gemini)
 * al inicio de una sesión de trabajo en este repositorio.
 * Su propósito es leer los archivos de configuración y reglas del proyecto
 * y generar un resumen estructurado que el asistente pueda usar para:
 * 1.  Configurar su comportamiento para la sesión actual.
 * 2.  Guardar las reglas fundamentales en su memoria a largo plazo.
 */

const OUTPUT_FORMAT = process.argv[2] || 'json'; // 'json' o 'human'

// Archivos a analizar
const FILES_TO_ANALYZE = {
    rules: 'GEMINI_RULES.md',
    pkg: 'package.json',
    tsconfig: 'tsconfig.json',
    tailwind: 'tailwind.config.mjs',
};

// Función para leer un archivo de forma segura
async function readFileSafe(filePath) {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null; // El archivo no existe, lo cual es manejable
        }
        throw error; // Otro tipo de error
    }
}

// Función para extraer información clave de GEMINI_RULES.md
function parseRules(content) {
    if (!content) return { longTerm: [], shortTerm: ['No se encontró GEMINI_RULES.md'] };

    const lines = content.split('\n');
    const longTerm = [];
    const shortTerm = [];

    const longTermKeywords = ['siempre debes', 'idioma principal', 'commits deben seguir', 'usar typescript', 'usar tailwind'];
    const shortTermKeywords = ['dependencias', 'scripts', 'arquitectura', 'testing'];

    lines.forEach(line => {
        const lowerLine = line.toLowerCase();
        if (longTermKeywords.some(kw => lowerLine.includes(kw))) {
            longTerm.push(line.replace(/^-/, '').trim());
        }
        if (shortTermKeywords.some(kw => lowerLine.includes(kw))) {
            shortTerm.push(line.replace(/^-/, '').trim());
        }
    });

    return {
        longTerm: longTerm.length > 0 ? longTerm : ['No se extrajeron reglas a largo plazo.'],
        shortTerm: shortTerm.length > 0 ? shortTerm : ['No se extrajeron reglas a corto plazo.'],
    };
}

// Función para extraer scripts de package.json
function parsePackageJson(content) {
    if (!content) return { scripts: 'No se encontró package.json', dependencies: 'N/A' };
    const pkg = JSON.parse(content);
    return {
        scripts: pkg.scripts ? Object.keys(pkg.scripts) : 'No hay scripts',
        dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : 'No hay dependencias',
    };
}

async function main() {
    const [rulesContent, pkgContent, tsconfigContent, tailwindContent] = await Promise.all([
        readFileSafe(FILES_TO_ANALYZE.rules),
        readFileSafe(FILES_TO_ANALYZE.pkg),
        readFileSafe(FILES_TO_ANALYZE.tsconfig),
        readFileSafe(FILES_TO_ANALYZE.tailwind),
    ]);

    const rules = parseRules(rulesContent);
    const pkgInfo = parsePackageJson(pkgContent);

    const report = {
        projectName: 'Markidev-2.0',
        onboardingCommand: 'gemini init',
        memory: {
            longTerm: [
                "En el proyecto 'Markidev-2.0', mi instrucción de inicio es 'gemini init' para ejecutar el script de onboarding.",
                ...rules.longTerm,
            ],
        },
        context: {
            shortTermRules: rules.shortTerm,
            scripts: pkgInfo.scripts,
            dependencies: pkgInfo.dependencies,
            usesTypeScript: !!tsconfigContent,
            usesTailwind: !!tailwindContent,
        },
    };

    if (OUTPUT_FORMAT === 'human') {
        console.log('--- INFORME DE ONBOARDING PARA GEMINI ---');
        console.log(`\n[ Memoria a Largo Plazo (para save_memory) ]`);
        report.memory.longTerm.forEach(fact => console.log(`- ${fact}`));

        console.log('\n[ Contexto para la Sesión Actual ]');
        console.log(`- Scripts disponibles: ${report.context.scripts.join(', ')}`);
        console.log(`- Usa TypeScript: ${report.context.usesTypeScript}`);
        console.log(`- Usa Tailwind CSS: ${report.context.usesTailwind}`);
        console.log('- Reglas de corto plazo:');
        report.context.shortTermRules.forEach(rule => console.log(`  - ${rule}`));
        console.log('\n--- FIN DEL INFORME ---');
    } else {
        console.log(JSON.stringify(report, null, 2));
    }
}

main().catch(error => {
    console.error('Error al generar el informe de onboarding:', error);
    process.exit(1);
});
