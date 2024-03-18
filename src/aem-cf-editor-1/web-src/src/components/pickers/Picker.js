import React, { useEffect, useState } from 'react';

import { defaultTheme, Provider, ListView, Item, Text, Image, Heading, Content, Breadcrumbs, ActionButton, Flex, Picker as RSPicker, View, IllustratedMessage, Button, ButtonGroup } from '@adobe/react-spectrum';
import Folder from '@spectrum-icons/illustrations/Folder';
import NotFound from '@spectrum-icons/illustrations/NotFound';
import Error from '@spectrum-icons/illustrations/Error';
import Copy from '@spectrum-icons/workflow/Copy';

const Picker = props => {
  const { blocks, getItems, getCategories, configFile, defaultConfig, handleSelection, handleClose } = props;

  const [state, setState] = useState({
    items: {},
    configs: {},
    selectedConfig: null,
    folder: null,
    path: [],
    categories: {},
    loadingState: 'loading',
    block: null,
    disabledKeys: new Set(),
    selectedItems: new Set(),
    showSettings: false,
    error: null,
    pageInfo: {
      current_page: 1,
      page_size: 0,
      total_pages: 0,
    },
  });

  const activeConfig = state.selectedConfig ? state.configs[state.selectedConfig] : null;

  const clickListItem = (key) => {
    const block = blocks[state.block] || {};
    if (!key.startsWith('category:') || block?.selection === 'multiple') {
      return;
    }
    selectFolder(key.replace('category:', ''));
  }

  const selectFolder = (key) => {
    if (key.startsWith('category:')) {
      key = key.replace('category:', '');
    }
    setState(state => ({
      ...state,
      items: {},
      folder: key,
      loadingState: 'loading',
    }));
  };

  const selectItem = (item) => {
    const key = item.anchorKey;
    console.log('on selection change, item:', item)
    console.log('on selection change, key:', key)
    if (key.startsWith('category:')) {
      selectFolder(key);
    } else {
      setState(state => ({
        ...state,
        selectedItems: [key],
      }));
    }
  };

  const copyToClipboard = key => {
    if (!state.block) {
      return;
    }

    let item = null;
    if (key instanceof Set) {
      item = [...key]
        .map(k => k.startsWith('category:') ? state.categories[k.replace('category:', '')] : state.items[k]);
    } else {
      item = key.startsWith('category:') ? state.categories[key.replace('category:', '')] : state.items[key];
    }

    const html = blocks[state.block].output(item);
    navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([html], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      }),
    ]);
  };

  const calculateDisabledKeys = (block, items, categories) => {
    // Disable item or folder depending on the block type
    const disabledKeys = new Set();
    if (block.type === 'item' && block.selection === 'multiple') {
      getCategoriesToDisplay(categories).forEach(i => disabledKeys.add(i.key));
    } else if (block.type === 'folder' && block.selection === 'multiple') {
      Object.values(items).forEach(i => disabledKeys.add(i.sku));
    }

    return disabledKeys;
  };

  const getCategoriesToDisplay = (categories) => {
    return Object.values(categories || {}).filter(c => c.parentId === state.folder);
  };

  const getPath = (categories) => {
    const pathString = categories[state.folder]?.path || '';
    return pathString.split('/').map(p => categories[p]).filter(p => p);
  }

  const renderEmptyState = () => (
    <IllustratedMessage>
      <NotFound />
      <Heading>No items found</Heading>
    </IllustratedMessage>
  );

  const renderErrorState = () => (
    <IllustratedMessage>
      <Error />
      <Heading>Something went wrong</Heading>
      <Content>{state.error}</Content>
    </IllustratedMessage>
  );

  const onLoadMore = async () => {
    if (!state.pageInfo || state.pageInfo.current_page >= state.pageInfo.total_pages || state.loadingState === 'loading') {
      return;
    }

    setState(state => ({
      ...state,
      loadingState: 'loading',
    }));

    const [items, pageInfo] = await getItems(state.folder, state.pageInfo?.current_page + 1, activeConfig);
    Object.values(items).forEach(i => {
      i.key = i.sku;
    });

    setState(state => {
      const newItems = { ...state.items, ...items };
      const blockObj = state.block ? blocks[state.block] : {};
      const disabledKeys = calculateDisabledKeys(blockObj, newItems, state.categories);

      return {
        ...state,
        items: newItems,
        disabledKeys,
        pageInfo,
        loadingState: 'idle',
      }
    });
  }

  useEffect(() => {
    (async () => {
      // Get configs and select default config
      let configs = {};
      try {
        configs = await fetch(configFile).then(r => r.json());
      } catch (err) {
          console.error(err);
          setState(state => ({
              ...state,
              error: 'Could not load config file',
          }));
          return;
      }
      // Ignore metadata
      Object.keys(configs).forEach(key => {
        if (key.startsWith(':')) {
          delete configs[key];
        }
      });

      // Flatten values
      Object.keys(configs).forEach(key => {
        const values = {};
        configs[key].data.forEach(e => {
          values[e.key] = e.value;
        });
        configs[key] = values;
      });

      const selectedConfig = defaultConfig || Object.keys(configs)[0];
      const rootCategoryKey = configs[selectedConfig]['commerce-root-category-id'];

      setState(state => ({
        ...state,
        configs,
        selectedConfig,
        folder: rootCategoryKey,
        path: [],
        categories: {},
        loadingState: 'loading',
        disabledKeys: new Set(),
        selectedItems: new Set(),
        pageInfo: {
          current_page: 1,
          page_size: 0,
          total_pages: 0,
        },
      }));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!activeConfig) {
        return;
      }

      let categories = {};
      try {
        categories = await getCategories(activeConfig['commerce-root-category-id'], activeConfig);
      } catch (err) {
        console.error(err);
        setState(state => ({
          ...state,
          error: 'Could not load categories',
        }));
        return;
      }

      Object.values(categories).forEach(c => {
        c.key = `category:${c.id}`;
        c.isFolder = true;
      });
      const path = getPath(categories);

      setState(state => {
        return {
          ...state,
          categories,
          path,
        }
      });
    })();
  }, [state.selectedConfig])

  useEffect(() => {
    (async () => {
      if (!activeConfig) {
        return;
      }

      let items = {};
      let pageInfo = {};
      try {
        [items, pageInfo] = await getItems(state.folder, 1, activeConfig);
      } catch (err) {
        console.error(err);
        setState(state => ({
          ...state,
          error: 'Could not load items',
        }));
        return;
      }

      Object.values(items).forEach(i => {
        i.key = i.sku;
      });

      setState(state => {
        const blockObj = state.block ? blocks[state.block] : {};
        const disabledKeys = calculateDisabledKeys(blockObj, items, state.categories);
        const path = getPath(state.categories);

        return {
          ...state,
          items,
          path,
          disabledKeys,
          pageInfo,
          loadingState: 'idle',
        }
      });
    })();
  }, [state.selectedConfig, state.folder]);

  const currentBlock = blocks[state.block] || {};
  const items = [...getCategoriesToDisplay(state.categories), ...Object.values(state.items)];

  if (state.error) {
    return <Provider theme={defaultTheme} height="100%">
      <Flex direction="column" height="100%">
        <View padding="size-500">
          {renderErrorState()}
        </View>
      </Flex>
    </Provider>;
  }

  return <Provider theme={defaultTheme} height="100%">
    <Flex direction="column" height="100%">
      <Breadcrumbs onAction={selectFolder} isDisabled={currentBlock.selection === 'multiple'}>
        {state.path.map(c => <Item key={c.key}>{c.name}</Item>)}
      </Breadcrumbs>
      <Flex height="70vh">
        <ListView aria-label="List of Items"
          selectionMode="single"
          selectionStyle="highlight"
          items={items}
          loadingState={state.loadingState}
          width="100%"
          height="100%"
          density="spacious"
          onAction={clickListItem}
          selectedKeys={state.selectedItems}
          onSelectionChange={selectItem}
          disabledKeys={state.disabledKeys}
          renderEmptyState={renderEmptyState}
          onLoadMore={onLoadMore}
        >
          {item => {
            if (item.isFolder) {
              return <Item key={item.key} textValue={item.name} hasChildItems={currentBlock.selection !== 'multiple'}>
                <Folder />
                <Text>{item.name}</Text>
                {item.childCount > 0 && <Text slot="description">{item.childCount} items</Text>}
                {currentBlock.selection === 'single' && (currentBlock.type === 'any' || currentBlock.type === 'folder') && <ActionButton aria-label="Copy" onPress={() => copyToClipboard(item.key)}><Copy /></ActionButton>}
              </Item>
            }

            return <Item key={item.key} textValue={item.name}>
              {item.images && item.images.length > 0 && <Image src={item.images[0].url} alt={item.name} objectFit="contain" />}
              <Text><span dangerouslySetInnerHTML={{ __html: item.name }} /></Text>
              {currentBlock.selection === 'single' && (currentBlock.type === 'any' || currentBlock.type === 'item') && <ActionButton aria-label="Copy" onPress={() => copyToClipboard(item.key)}><Copy /></ActionButton>}
            </Item>;
          }}
        </ListView>
      </Flex>
      <ButtonGroup marginTop={50} marginStart="auto">
        <Button variant="secondary" onPress={() => handleClose()}>Cancel</Button>
        <Button variant="accent" onPress={() => {
          console.log('state.selectedItems:', state.selectedItems);
          if (state.selectedItems.size === 0) {
            return;
          }
          handleSelection(state.selectedItems[0]);
        }}>Confirm</Button>
      </ButtonGroup>
    </Flex>
  </Provider>;
}

export default Picker;