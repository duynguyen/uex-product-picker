/*
 * <license header>
 */

import React, { useState, useEffect } from "react";
import { attach } from "@adobe/uix-guest";
import {
  Provider,
  Content,
  defaultTheme,
  Flex,
  TextField,
  ActionButton,
  LabeledValue,
} from "@adobe/react-spectrum";
import { extensionId } from "./Constants";

export default function () {
  const [guestConnection, setGuestConnection] = useState();
  const [model, setModel] = useState({});
  const [value, setValue] = useState('');

  const handleStorageChange = (event) => {
    if (event.key === 'selectedProduct') {
      setValue(event.newValue);
    }
  };

  const onChangeHandler = (newValue) => {
    // TODO onChange is not triggered when the value is set programmatically (upon local storage change)
    // TODO onChange api is not working as expected (UE extension issue)
    guestConnection.host.field.onChange('', newValue);
};

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
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Get basic state from guestConnection
  useEffect(() => {
    if (!guestConnection) {
      return;
    }
    const getState = async () => {
      setModel(await guestConnection.host.field.getModel());
      setValue(await guestConnection.host.field.getValue());
    };
    getState().catch((e) => console.error("Extension error:", e));
  }, [guestConnection]);

  const showModal = () => {
    guestConnection.host.modal.showUrl({
      title: "Product Picker",
      url: "/index.html#/product-picker-modal",
      width: "80vw",
      height: "70vh",
    });
  };

  return (
    <Provider theme={defaultTheme} colorScheme='light'>
      <Content>
        <Flex direction='column'>
          <LabeledValue label="Product" value='' />
          <Flex direction='row'>
            <TextField value={value} flexGrow={1} isReadOnly onChange={onChangeHandler} />
            <ActionButton
              onPress={showModal}
              aria-label='select asset'
              marginStart="size-150">
              Select asset
            </ActionButton>
          </Flex>
        </Flex>
      </Content>
    </Provider>
  );
}
