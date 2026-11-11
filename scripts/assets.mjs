#!/usr/bin/env node
/**
 * Builds public/models/nature.glb from the CC0 glTF files in assets-src/ (only the models listed below ship).
 * Textures are resized and converted to WebP, meshes welded and quantized, everything merged into one file
 * whose root nodes are named after the models so the game can find them.
 * usage: npm run assets
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, weld, quantize, mergeDocuments, unpartition } from '@gltf-transform/functions';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

export const PACKS = {
  'quaternius-stylized-nature-megakit': {
    out: 'nature.glb',
    maxTexture: 512,
    models: [
      'CommonTree_1', 'Pine_3', 'Pine_5', 'Bush_Common_Flowers', 'Flower_3_Group', 'Flower_4_Group',
      'Grass_Common_Tall', 'Plant_1_Big', 'Rock_Medium_1', 'Rock_Medium_2', 'Pebble_Round_1', 'Mushroom_Common', 'DeadTree_1', 'Pine_1',
    ],
  },
};

async function buildPack(name) {
  const pack = PACKS[name];
  const dir = path.join(ROOT, 'assets-src', name);
  let doc = null;
  for (const m of pack.models) {
    const d = await io.read(path.join(dir, `${m}.gltf`));
    for (const mat of d.getRoot().listMaterials()) mat.setNormalTexture(null);
    const scene = d.getRoot().getDefaultScene() ?? d.getRoot().listScenes()[0];
    const root = d.createNode(m);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      root.addChild(child);
    }
    scene.addChild(root);
    if (!doc) doc = d;
    else mergeDocuments(doc, d);
  }
  const scenes = doc.getRoot().listScenes();
  for (const s of scenes.slice(1)) {
    for (const c of s.listChildren()) scenes[0].addChild(c);
    s.dispose();
  }
  doc.getRoot().setDefaultScene(scenes[0]);
  await doc.transform(
    unpartition(),
    dedup(),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [pack.maxTexture, pack.maxTexture], quality: 80 }),
    quantize(),
    prune(),
  );
  const outDir = path.join(ROOT, 'public', 'models');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, pack.out);
  await io.write(out, doc);
  console.log(`${pack.out}: ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}

for (const name of Object.keys(PACKS)) await buildPack(name);
