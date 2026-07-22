import { defineConfig } from "vite";

const cdlValueEndpoint =
  "https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLValue";

export default defineConfig({
  plugins: [
    {
      name: "cdl-value-proxy",
      configureServer(server) {
        server.middlewares.use("/api/cdl-value", async (request, response) => {
          try {
            const requestUrl = new URL(request.url ?? "", "http://localhost");
            const upstreamUrl = `${cdlValueEndpoint}${requestUrl.search}`;
            const upstreamResponse = await fetch(upstreamUrl);
            const body = await upstreamResponse.text();

            response.statusCode = upstreamResponse.status;
            response.setHeader(
              "content-type",
              upstreamResponse.headers.get("content-type") ?? "application/xml",
            );
            response.end(body);
          } catch (error) {
            response.statusCode = 502;
            response.setHeader("content-type", "text/plain");
            response.end(error instanceof Error ? error.message : "CDL proxy failed");
          }
        });
      },
    },
  ],
});
