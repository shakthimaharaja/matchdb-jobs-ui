const HtmlWebpackPlugin = require('html-webpack-plugin');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const Dotenv = require('dotenv-webpack');
const path = require('path');
const deps = require('./package.json').dependencies;

module.exports = (env = {}) => {
  const envName = env.production ? 'production' : env.qa ? 'qa' : 'development';
  const envFile = path.resolve(__dirname, `env/.env.${envName}`);

  return {
    entry: './src/index.ts',
    mode: envName === 'development' ? 'development' : 'production',
    devtool: envName === 'development' ? 'inline-source-map' : false,
    output: {
      publicPath: 'auto',
      filename: '[name].[contenthash].js',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx'],
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          use: 'ts-loader',
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader'],
        },
      ],
    },
    plugins: [
      new Dotenv({ path: envFile, safe: false, systemvars: true }),
      new ModuleFederationPlugin({
        name: 'matchdbJobs',
        filename: 'remoteEntry.js',
        exposes: {
          './JobsApp': './src/JobsApp',
        },
        shared: {
          react: { singleton: true, requiredVersion: deps.react },
          'react-dom': { singleton: true, requiredVersion: deps['react-dom'] },
          'react-router-dom': { singleton: true, requiredVersion: deps['react-router-dom'] },
          'react-redux': { singleton: true, requiredVersion: deps['react-redux'] },
          '@reduxjs/toolkit': { singleton: true, requiredVersion: deps['@reduxjs/toolkit'] },
        },
      }),
      new HtmlWebpackPlugin({
        template: './public/index.html',
        title: 'MatchDB Jobs',
      }),
    ],
    devServer: {
      port: 3001,
      historyApiFallback: true,
      hot: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
      proxy: [
        {
          context: ['/api/jobs'],
          target: 'http://localhost:4001',
          changeOrigin: true,
        },
      ],
    },
  };
};
