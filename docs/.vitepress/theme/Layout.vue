<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { inBrowser } from 'vitepress';
import { setupCodeGroupSync } from './codeGroupSync';

const { Layout } = DefaultTheme;

if (inBrowser) {
  setupCodeGroupSync();
}
</script>

<template>
  <Layout />
</template>
