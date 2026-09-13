import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { expect, test } from 'vitest';

test('rebuilding the same release removes assets from the previous build', async () => {
    const root = mkdtempSync(join(tmpdir(), 'publisher-package-'));
    try {
        mkdirSync(join(root, 'scripts'));
        mkdirSync(join(root, 'dist'));
        copyFileSync(new URL('./package.js', import.meta.url), join(root, 'scripts/package.js'));
        writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'publisher', version: '0.1.0', type: 'module' }));
        execFileSync('git', ['init', '--quiet'], { cwd: root });
        execFileSync('git', ['-c', 'user.name=Release test', '-c', 'user.email=release@example.test', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '-m', 'fixture'], { cwd: root });
        const buildPackage = () => execFileSync(process.execPath, ['scripts/package.js'], { cwd: root, stdio: 'pipe' });

        writeFileSync(join(root, 'dist/old.js'), 'previous build');
        buildPackage();
        rmSync(join(root, 'dist/old.js'));
        writeFileSync(join(root, 'dist/index.html'), 'current build');
        writeFileSync(join(root, 'dist/index.js.map'), 'source map');
        buildPackage();

        const archives = readdirSync(join(root, 'releases'));
        expect(archives).toHaveLength(1);
        const zip = await JSZip.loadAsync(readFileSync(join(root, 'releases', archives[0]!)));
        expect(Object.keys(zip.files).sort()).toEqual(['dist/', 'dist/index.html']);
        expect(await zip.file('dist/index.html')!.async('string')).toBe('current build');
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
