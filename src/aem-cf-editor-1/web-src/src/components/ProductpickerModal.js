/*
 * <license header>
 */

import React, { useState, useEffect } from "react";
import { attach } from "@adobe/uix-guest";
import {
  Provider,
  Content,
  defaultTheme,
  Heading,
  Divider,
} from "@adobe/react-spectrum";
import { extensionId } from "./Constants";
import Picker from "./pickers/Picker";
import getCategoriesInCategory from './pickers/queries/categories.graphql.js';
import getProductsInCategory from './pickers/queries/products.graphql.js';

const configFile='https://main--aem-boilerplate-commerce--hlxsites.hlx.live/configs.json';
const defaultConfig = 'prod';

const blocks = {
  'identifier': {
      'key': 'identifier',
      'name': 'Identifier only',
      'output': i => i.isFolder ? i.id : i.sku,
      'selection': 'single',
      'type': 'any',
  },
  'product-list-page': {
      'key': 'product-list-page',
      'name': 'Product List Page',
      'output': i => `<table width="100%" style="border: 1px solid black;">
          <tr>
              <th colspan="2" style="border: 1px solid black; background: lightgray;">Product List Page</th>
          </tr>
          <tr>
              <td style="border: 1px solid black">category</td>
              <td style="border: 1px solid black">${i.id}</td>
          </tr>
      </table>`,
      'selection': 'single',
      'type': 'folder',
  },
  'product-teaser': {
      'key': 'product-teaser',
      'name': 'Product Teaser',
      'output': i => `<table width="100%" style="border: 1px solid black;">
          <tr>
              <th colspan="2" style="border: 1px solid black; background: lightgray;">Product Teaser</th>
          </tr>
          <tr>
              <td style="border: 1px solid black">SKU</td>
              <td style="border: 1px solid black">${i.sku}</td>
          </tr>
          <tr>
              <td style="border: 1px solid black">Details Button</td>
              <td style="border: 1px solid black">true</td>
          </tr>
          <tr>
              <td style="border: 1px solid black">Cart Button</td>
              <td style="border: 1px solid black">true</td>
          </tr>
      </table>`,
      'selection': 'single',
      'type': 'item',
  },
  'product-carousel': {
      'key': 'product-carousel',
      'name': 'Product Carousel',
      'output': items => `<table width="100%" style="border: 1px solid black;">
          <tr>
              <th style="border: 1px solid black; background: lightgray;">Product Carousel</th>
          </tr>
          <tr>
              <td style="border: 1px solid black">
                  <ul>
                      ${items.map(i => `<li>${i.sku}</li>`).join('')}
                  </ul>
              </td>
          </tr>
      </table>`,
      'selection': 'multiple',
      'type': 'item',
  },
  'category-carousel': {
      'key': 'category-carousel',
      'name': 'Category Carousel',
      'output': items => `<table width="100%" style="border: 1px solid black;">
          <tr>
              <th style="border: 1px solid black; background: lightgray;">Category Carousel</th>
          </tr>
          <tr>
              <td style="border: 1px solid black">
                  <ul>
                      ${items.map(i => `<li>${i.id}</li>`).join('')}
                  </ul>
              </td>
          </tr>
      </table>`,
      'selection': 'multiple',
      'type': 'folder',
  },
};

async function performCatalogServiceQuery(query, config, variables) {
  const headers = {
      'Magento-Environment-Id': config['commerce-environment-id'],
      'Magento-Store-View-Code': config['commerce-store-view-code'],
      'Magento-Website-Code': config['commerce-website-code'],
      'x-api-key': config['commerce-x-api-key'],
      'Magento-Store-Code': config['commerce-store-code'],
      'Magento-Customer-Group': config['commerce-customer-group'],
      'Content-Type': 'application/json',
  };

  const apiCall = new URL(config['commerce-endpoint']);
  apiCall.searchParams.append('query', query.replace(/(?:\r\n|\r|\n|\t|[\s]{4})/g, ' ')
      .replace(/\s\s+/g, ' '));
  apiCall.searchParams.append('variables', variables ? JSON.stringify(variables) : null);

  const response = await fetch(apiCall, {
      method: 'GET',
      headers,
  });

  if (!response.ok) {
      return null;
  }

  const queryResponse = await response.json();

  return queryResponse.data;
}

const getItems = async (folderKey, page = 1, config) => {
  let newItems = {};
  let pageInfo = {};
  try {
      const products = await performCatalogServiceQuery(getProductsInCategory, config, { id: folderKey, currentPage: page });
      products?.productSearch?.items.forEach(product => {
          const { productView } = product;

          try {
              productView.images.forEach(image => {
                  const url = new URL(image.url, window.location);
                  url.searchParams.set('width', 40);
                  image.url = url.toString();
              });
          } catch { }

          newItems[productView.sku] = {
              ...productView
          };
      });
      pageInfo = products?.productSearch?.page_info;
  } catch (err) {
      console.error('Could not retrieve products', err);
  }

  return [newItems, pageInfo];
};

const getCategories = async (folderKey, config) => {
  let categoryObject = {};

  try {
      const categories = await performCatalogServiceQuery(getCategoriesInCategory, config, { id: folderKey });
      categories?.categories.forEach(category => {
          categoryObject[category.id] = category;
      });
  } catch (err) {
      console.error('Could not retrieve categories', err);
  }

  return categoryObject;
}

export default function () {
  const [guestConnection, setGuestConnection] = useState();
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");

  const init = async () => {
    const connection = await attach({
      id: extensionId,
    });
    setGuestConnection(connection);
  };

  useEffect(() => {
    init().catch((e) =>
      console.log("Extension got the error during initialization:", e)
    );
  }, []);

  const onSelectionHandler = (product) => {
    console.log(`Selected product: ${product}`);
    localStorage.setItem('selectedProduct', product);
    onCloseHandler();
  };

  const onCloseHandler = () => {
    guestConnection.host.modal.close();
  };

  // Get basic state from guestConnection
  useEffect(() => {
    if (!guestConnection) {
      return;
    }
    const getState = async () => {
      const context = guestConnection.sharedContext;
      const imsToken = context.get("token");
      setToken(imsToken);
      const tempEditorState = await guestConnection.host.editorState.get();
      const { connections, customTokens } = tempEditorState;
      const tempEndpointName = Object.keys(connections).filter((key) =>
        connections[key].startsWith("xwalk:")
      )[0];
      if (tempEndpointName) {
        setEndpoint(connections[tempEndpointName].replace("xwalk:", ""));
        if (customTokens && customTokens[tempEndpointName]) {
          setToken(customTokens[tempEndpointName].replace("Bearer ", ""));
        }
      }
    };
    getState().catch((e) => console.error("Extension error:", e));
  }, [guestConnection]);

  return (
    <Provider theme={defaultTheme} colorScheme='light'>
      <Heading>Select product</Heading>
      <Divider />
      <Content>
        <Picker
          blocks={blocks}
          getCategories={getCategories}
          getItems={getItems}
          handleSelection={onSelectionHandler}
          handleClose={onCloseHandler}
          configFile={configFile}
          defaultConfig={defaultConfig} />
      </Content>
    </Provider>
  );
}
