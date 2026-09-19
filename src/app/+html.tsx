import type { PropsWithChildren } from "react";

import { ScrollViewStyleReset } from "expo-router/html";

/**
 * Web 根 HTML：用 100dvh 鎖死可視高度，避免 Chrome 手機模式把底部 Tab 裁掉。
 * @see https://docs.expo.dev/router/reference/static-rendering/#root-html
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="zh-Hant">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                height: 100%;
                height: 100dvh;
                max-height: 100dvh;
                margin: 0;
                overflow: hidden;
              }
              #root {
                display: flex;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
