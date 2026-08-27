import { Injectable } from '@nestjs/common';
import { getHomeLayout } from './templates/home-layout.template.js';
import { getHomeScripts } from './templates/home-scripts.template.js';
import { getHomeStyles } from './templates/home-styles.template.js';

@Injectable()
export class HomePageService {
  renderHomePageHtml(): string {
    const instanceId = process.env.INSTANCE_ID ?? 'api-unknown';
    const styles = getHomeStyles();
    const layout = getHomeLayout(instanceId);
    const scripts = getHomeScripts();

    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flash Sale System — Developer Playground</title>
  <style>
${styles}
  </style>
</head>
<body>
${layout}
  <script>
${scripts}
  </script>
</body>
</html>`;
  }
}
