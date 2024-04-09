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
  const [selections, setSelections] = useState([]);
  const [isValueSet, setIsValueSet] = useState(false);

  const handleStorageChange = (event) => {
    if (event.key === selectedProductEventName) {
      setIsValueSet(true);
      setValue(event.newValue);
      setSelections(event.newValue?.split(',') || []);
      customCifField.current.focus();
      localStorage.removeItem(selectedProductEventName);
    }
  };

  const onChangeHandler = (event) => {
    const newValue = event.target.value;
    guestConnection.host.field.onChange(newValue);
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
      const newValue = await guestConnection.host.field.getValue();
      setValue(newValue);
      setSelections(value?.split(',').map((item) => item) || []);
    };
    getState().catch((e) => console.error("Extension error:", e));
  }, [guestConnection]);

  useEffect(() => {
    if (guestConnection && !isValueSet) {
      const getState = async () => {
        setModel(await guestConnection.host.field.getModel());
        const newValue = await guestConnection.host.field.getValue();
        setValue(newValue);
        setSelections(value?.split(',').map((item) => item) || []);
      };
      getState().catch((e) => console.error("Extension error:", e));
    }
    setIsValueSet(false);
  }, [value]);

  const showModal = () => {
    // save the current value to local storage
    localStorage.setItem(selectedProductEventName, value);
    guestConnection.host.modal.showUrl({
      title: "Product Picker",
      url: "/index.html#/product-picker-modal",
      width: "80vw",
      height: "70vh",
    });
  };

  const saveSelectionChanges = (newSelections) => {
    setSelections(newSelections.map((item) => item) || []);
    const selectedProduct = newSelections.join(',');
    setIsValueSet(true);
    setValue(selectedProduct);
    onChangeHandler({ target: { value: selectedProduct } });
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
              aria-label='select product'
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
