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
import { extensionId, selectedProductEventName } from "./Constants";
import Picker from "./pickers/Picker";
import getCategoriesInCategory from './pickers/queries/categories.graphql.js';
import getProductsInCategory from './pickers/queries/products.graphql.js';
import searchProducts from './pickers/queries/productSearch.graphql.js';

const configFile = 'https://main--aem-boilerplate-commerce--hlxsites.hlx.live/configs.json';
const defaultConfig = 'prod';

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

const searchItems = async (searchTerm, page, config) => {
  let newItems = {};
  let pageInfo = {};
  try {
    const products = await performCatalogServiceQuery(searchProducts, config, { searchTerm, currentPage: page });
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
    console.error('Could not search products', err);
  }
  return [newItems, pageInfo];
};

export default function () {
  const [guestConnection, setGuestConnection] = useState();
  const [selectedItems, setSelectedItems] = useState([]);
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");

  const init = async () => {
    const connection = await attach({
      id: extensionId,
    });
    setGuestConnection(connection);
    const selectedItemsString = localStorage.getItem(selectedProductEventName);
    let preselectedItems = [];
    if (selectedItemsString && selectedItemsString != 'null') {
      preselectedItems = selectedItemsString?.split(',').map((item) => item);
    }
    setSelectedItems(preselectedItems);
    localStorage.removeItem(selectedProductEventName);
  };

  useEffect(() => {
    init().catch((e) =>
      console.log("Extension got the error during initialization:", e)
    );
  }, []);

  const onSelectionHandler = (products) => {
    localStorage.setItem(selectedProductEventName, products);
    onCloseHandler();
  };

  const onCloseHandler = () => {
    guestConnection.host.modal.close();
  };

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
          getCategories={getCategories}
          getItems={getItems}
          searchItems={searchItems}
          preselectedItems={selectedItems}
          handleSelection={onSelectionHandler}
          handleClose={onCloseHandler}
          configFile={configFile}
          defaultConfig={defaultConfig} />
      </Content>
    </Provider>
  );
}
