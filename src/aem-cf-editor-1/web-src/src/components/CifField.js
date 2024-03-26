/*
 * <license header>
 */

import React, { useState, useEffect, useRef } from "react";
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
import { TagList } from "./TagList";
import { extensionId, selectedProductEventName } from "./Constants";

export default function () {
  const [guestConnection, setGuestConnection] = useState();
  const customCifField = useRef(null);
  const [model, setModel] = useState({});
  const [value, setValue] = useState('');
  const [selections, setSelections] = useState();

  const handleStorageChange = (event) => {
    if (event.key === selectedProductEventName) {
      setValue(event.newValue);
      console.log('Setting value from local storage:', event.newValue);
      setSelections(event.newValue?.split(',') || []);
      console.log('Setting selections from local storage:', selections);
      customCifField.current.focus();
      localStorage.removeItem(selectedProductEventName);
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
      setValue(await guestConnection.host.field.getValue() || '');
    };
    getState().catch((e) => console.error("Extension error:", e));
  }, [guestConnection]);

  useEffect(() => {
    console.log('persisting value:', value);
    if (guestConnection) {
      guestConnection.host.field.onChange('', value);
    }
  }, [value]);

  const showModal = () => {
    guestConnection.host.modal.showUrl({
      title: "Product Picker",
      url: "/index.html#/product-picker-modal",
      width: "80vw",
      height: "70vh",
    });
  };

  const saveSelectionChanges = (newSelections) => {
    console.log('New selections:', newSelections);
    setSelections(newSelections);
  };

  return (
    <Provider theme={defaultTheme} colorScheme='light'>
      <Content>
        <Flex direction='column'>
          <LabeledValue label="Product" value='' />
          <Flex direction='row'>
            <TextField ref={customCifField} value={value} flexGrow={1} isReadOnly onFocus={onChangeHandler}/>
            <ActionButton
              onPress={showModal}
              aria-label='select asset'
              marginStart="size-150">
              Select
            </ActionButton>
          </Flex>
          <Flex direction='row'>
            <TagList setSelections={saveSelectionChanges} selections={selections} />
          </Flex>
        </Flex>
      </Content>
    </Provider>
  );
}
