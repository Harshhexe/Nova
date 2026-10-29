import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {suggestionsHandler} from './server/suggestions.mjs';
export default defineConfig({plugins:[react(),tailwindcss(),{name:'nova-google-autocomplete',configureServer(server){server.middlewares.use(suggestionsHandler)},configurePreviewServer(server){server.middlewares.use(suggestionsHandler)}}],base:'./'});
