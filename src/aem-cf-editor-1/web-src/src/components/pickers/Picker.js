import React, { useEffect, useState } from 'react';

import { defaultTheme, Provider, ListView, Item, Text, Image, Heading, Content, Breadcrumbs, Flex, View, IllustratedMessage, Button, ButtonGroup, TextField } from '@adobe/react-spectrum';
import Folder from '@spectrum-icons/illustrations/Folder';
import NotFound from '@spectrum-icons/illustrations/NotFound';
import Error from '@spectrum-icons/illustrations/Error';

const Picker = props => {
  const { getItems, getCategories, searchItems, configFile, defaultConfig, handleSelection, handleClose } = props;
  const [state, setState] = useState({
    items: {},
    configs: {},
    selectedConfig: null,
    folder: null,
    path: [],
    categories: {},
    loadingState: 'loading',
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
    if (!key.startsWith('category:')) {
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
    if (key.startsWith('category:')) {
      selectFolder(key);
    } else {
      if (state.selectedItems.has(key)) {
        state.selectedItems.delete(key);
      } else {
        state.selectedItems.add(key);
      }
      setState(state => ({
        ...state,
      }));
    }
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

      return {
        ...state,
        items: newItems,
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
        const path = getPath(state.categories);

        return {
          ...state,
          items,
          path,
          pageInfo,
          loadingState: 'idle',
        }
      });
    })();
  }, [state.selectedConfig, state.folder]);

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

  const handleSearch = (searchValue) => {
    if (!searchValue) {
      setState(state => ({
        ...state,
        folder: state.configs['prod']['commerce-root-category-id'],
        items: {},
        path: [],
        loadingState: 'idle',
      }));
      return;
    }
    searchItems(searchValue, 1, activeConfig).then(([items, pageInfo]) => {
      Object.values(items).forEach(i => {
        i.key = i.sku;
      });

      setState(state => ({
        ...state,
        items,
        folder: null,
        path: [],
        pageInfo,
        loadingState: 'idle',
      }));
    });
  };

  return <Provider theme={defaultTheme} height="100%">
    <Flex direction="column" height="100%">
      <TextField type="text" onChange={handleSearch} />
      <Breadcrumbs onAction={selectFolder}>
        {state.path.map(c => <Item key={c.key}>{c.name}</Item>)}
      </Breadcrumbs>
      <Flex direction='column' height="70vh">
        <ListView aria-label="List of Items"
          selectionMode="multiple"
          selectionStyle="highlight"
          items={items}
          loadingState={state.loadingState}
          width="100%"
          height="100%"
          density="spacious"
          onAction={clickListItem}
          selectedKeys={Array.from(state.selectedItems)}
          onSelectionChange={selectItem}
          renderEmptyState={renderEmptyState}
          onLoadMore={onLoadMore}
        >
          {item => {
            if (item.isFolder) {
              return <Item key={item.key} textValue={item.name}>
                <Folder />
                <Text>{item.name}</Text>
                {item.childCount > 0 && <Text slot="description">{item.childCount} items</Text>}
              </Item>
            } else {
              return <Item key={item.key} textValue={item.name}>
                {item.images && item.images.length > 0 && <Image src={item.images[0].url} alt={item.name} objectFit="contain" />}
                <Text><span dangerouslySetInnerHTML={{ __html: item.name }} /></Text>
              </Item>;
            }
          }}
        </ListView>
        <Flex direction="row" marginTop="size-200">
          <Text>Selected Items:</Text>
          {Array.from(state.selectedItems)?.map(selectedItem => (
            <Text key={selectedItem}>{selectedItem},</Text>
          ))}
        </Flex>
      </Flex>
      <ButtonGroup marginTop={50} marginStart="auto">
        <Button variant="secondary" onPress={() => handleClose()}>Cancel</Button>
        <Button variant="accent" onPress={() => {
          if (state.selectedItems.size === 0) {
            return;
          }
          handleSelection(Array.from(state.selectedItems));
        }}>Confirm</Button>
      </ButtonGroup>
    </Flex>
  </Provider>;
}

export default Picker;
