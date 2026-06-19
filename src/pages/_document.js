import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
      <link rel="icon" href="/favicon.ico" sizes="any"/>
      <link rel="apple-touch-icon" href="/favicon.svg"/>
      <meta name="theme-color" content="#030604"/>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
