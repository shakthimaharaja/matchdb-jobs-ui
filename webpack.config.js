const HtmlWebpackPlugin = require("html-webpack-plugin");
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const { DefinePlugin } = require("webpack");
const dotenv = require("dotenv");
const path = require("node:path");
const deps = require("./package.json").dependencies;

module.exports = function webpackConfig(env = {}) {
  let envName;
  if (env.production) envName = "production";
  else if (env.qa) envName = "qa";
  else if (env.development) envName = "development";
  else envName = "local";
  const envFile = path.resolve(__dirname, `env/.env.${envName}`);

  const isDev = envName === "local" || envName === "development";
  const useHttps = Boolean(env.https);

  // Read .env file vars manually — skip NODE_ENV to avoid conflicting with
  // webpack's own mode-based DefinePlugin definition.
  const envVars = dotenv.config({ path: envFile }).parsed || {};
  const envDefines = Object.fromEntries(
    Object.entries(envVars)
      .filter(([key]) => key !== "NODE_ENV")
      .map(([key, val]) => [`process.env.${key}`, JSON.stringify(val)]),
  );

  return {
    entry: "./src/index.ts",
    mode: isDev ? "development" : "production",
    devtool: isDev ? "inline-source-map" : false,
    output: {
      publicPath: "auto",
      filename: "[name].[contenthash].js",
      path: path.resolve(__dirname, "dist"),
      clean: true,
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js", ".jsx"],
      alias: { "@": path.resolve(__dirname, "src") },
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: "ts-loader",
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader", "postcss-loader"],
        },
      ],
    },
    plugins: [
      new DefinePlugin(envDefines),
      new ModuleFederationPlugin({
        name: "matchdbJobs",
        filename: "remoteEntry.js",
        exposes: {
          "./JobsApp": "./src/JobsApp",
        },
        shared: {
          react: { singleton: true, requiredVersion: deps.react },
          "react-dom": { singleton: true, requiredVersion: deps["react-dom"] },
          "react-router-dom": {
            singleton: true,
            requiredVersion: deps["react-router-dom"],
          },
          "react-redux": {
            singleton: true,
            requiredVersion: deps["react-redux"],
          },
          "@reduxjs/toolkit": {
            singleton: true,
            requiredVersion: deps["@reduxjs/toolkit"],
          },
        },
      }),
      new HtmlWebpackPlugin({
        template: "./public/index.html",
        title: "MatchDB Jobs",
      }),
    ],
    devServer: {
      port: 3001,
      // Pass --env https to enable HTTPS (uses webpack-dev-server's built-in cert)
      server: useHttps ? "https" : "http",
      historyApiFallback: true,
      hot: true,
      headers: { "Access-Control-Allow-Origin": "*" },
      client: {
        webSocketURL: { pathname: "/hmr" },
      },
      webSocketServer: {
        type: "ws",
        options: { path: "/hmr" },
      },
      proxy: [
        {
          // All API traffic goes through shell-services gateway (:8000)
          context: ["/api"],
          target: "http://localhost:8000",
          changeOrigin: true,
        },
      ],
    },
  };
};
