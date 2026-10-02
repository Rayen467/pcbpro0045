(() => {
  'use strict';
  if (window.PCBProComponentCatalog) return;

  const VERSION='1.16.0';
  const items=[];
  const seen=new Set();
  const slug=(v)=>String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const add=(p)=>{
    const key=p.key||slug([p.group,p.name,p.value,p.package||p.footprint,p.mpn].filter(Boolean).join('-'));
    if(!key||seen.has(key))return;
    seen.add(key);
    items.push({
      key,
      prefix:p.prefix||'U',
      code:p.code||p.prefix||'U',
      name:p.name,
      value:p.value||p.mpn||'',
      group:p.group||'Other',
      footprint:p.footprint||'—',
      pinCount:Number.isFinite(Number(p.pinCount))?Number(p.pinCount):0,
      kind:p.kind||'template',
      manufacturer:p.manufacturer||'',
      mpn:p.mpn||'',
      tags:Array.isArray(p.tags)?p.tags:[],
      description:p.description||'',
      provenance:p.provenance||'catalog-template'
    });
  };
  const each=(list,fn)=>list.forEach(fn);

  // Parametric passives — broad, searchable templates. Exact ratings are intentionally not assumed.
  const resistorValues=['0 Ω','1 Ω','2.2 Ω','3.3 Ω','4.7 Ω','6.8 Ω','10 Ω','15 Ω','22 Ω','33 Ω','47 Ω','68 Ω','100 Ω','150 Ω','220 Ω','330 Ω','470 Ω','680 Ω','1 kΩ','1.5 kΩ','2.2 kΩ','3.3 kΩ','4.7 kΩ','6.8 kΩ','10 kΩ','15 kΩ','22 kΩ','33 kΩ','47 kΩ','68 kΩ','100 kΩ','150 kΩ','220 kΩ','330 kΩ','470 kΩ','680 kΩ','1 MΩ','2.2 MΩ','4.7 MΩ','10 MΩ'];
  const rPkgs=[
    ['0201','Resistor_SMD:R_0201_0603Metric'],['0402','Resistor_SMD:R_0402_1005Metric'],['0603','Resistor_SMD:R_0603_1608Metric'],['0805','Resistor_SMD:R_0805_2012Metric'],
    ['1206','Resistor_SMD:R_1206_3216Metric'],['1210','Resistor_SMD:R_1210_3225Metric'],['2010','Resistor_SMD:R_2010_5025Metric'],['2512','Resistor_SMD:R_2512_6332Metric']
  ];
  each(resistorValues,v=>each(rPkgs,([pkg,fp])=>add({prefix:'R',code:'R',name:`Resistor ${pkg}`,value:v,group:'Passives',footprint:fp,pinCount:2,tags:['resistor','smd',pkg],description:'Generic resistor template; choose tolerance, power rating and exact MPN before production.'})));

  const capacitorValues=['1 pF','2.2 pF','4.7 pF','10 pF','22 pF','47 pF','100 pF','220 pF','470 pF','1 nF','2.2 nF','4.7 nF','10 nF','22 nF','47 nF','100 nF','220 nF','470 nF','1 µF','2.2 µF','4.7 µF','10 µF','22 µF','47 µF','100 µF','220 µF','470 µF','1000 µF'];
  const cPkgs=[
    ['0201','Capacitor_SMD:C_0201_0603Metric'],['0402','Capacitor_SMD:C_0402_1005Metric'],['0603','Capacitor_SMD:C_0603_1608Metric'],['0805','Capacitor_SMD:C_0805_2012Metric'],
    ['1206','Capacitor_SMD:C_1206_3216Metric'],['1210','Capacitor_SMD:C_1210_3225Metric'],['1812','Capacitor_SMD:C_1812_4532Metric'],['2220','Capacitor_SMD:C_2220_5750Metric']
  ];
  each(capacitorValues,v=>each(cPkgs,([pkg,fp])=>add({prefix:'C',code:'C',name:`Ceramic Capacitor ${pkg}`,value:v,group:'Passives',footprint:fp,pinCount:2,tags:['capacitor','mlcc','smd',pkg],description:'Generic MLCC template; dielectric, DC-bias derating, voltage rating and exact MPN remain unresolved.'})));

  const electrolyticValues=['1 µF','2.2 µF','4.7 µF','10 µF','22 µF','47 µF','100 µF','220 µF','470 µF','1000 µF','2200 µF','4700 µF'];
  const ePkgs=[['D4','Capacitor_THT:CP_Radial_D4.0mm_P1.50mm'],['D5','Capacitor_THT:CP_Radial_D5.0mm_P2.00mm'],['D6.3','Capacitor_THT:CP_Radial_D6.3mm_P2.50mm'],['D8','Capacitor_THT:CP_Radial_D8.0mm_P3.50mm'],['D10','Capacitor_THT:CP_Radial_D10.0mm_P5.00mm']];
  each(electrolyticValues,v=>each(ePkgs,([pkg,fp])=>add({prefix:'C',code:'CP',name:`Polarized Capacitor ${pkg}`,value:v,group:'Passives',footprint:fp,pinCount:2,tags:['capacitor','electrolytic','polarized','tht'],description:'Generic polarized capacitor template; verify polarity, ESR, ripple current, voltage and lifetime.'})));

  const inductorValues=['100 nH','220 nH','470 nH','1 µH','2.2 µH','3.3 µH','4.7 µH','6.8 µH','10 µH','15 µH','22 µH','33 µH','47 µH','68 µH','100 µH','150 µH','220 µH','330 µH','470 µH','680 µH','1 mH','2.2 mH','4.7 mH'];
  const lPkgs=[['0402','Inductor_SMD:L_0402_1005Metric'],['0603','Inductor_SMD:L_0603_1608Metric'],['0805','Inductor_SMD:L_0805_2012Metric'],['1206','Inductor_SMD:L_1206_3216Metric'],['1210','Inductor_SMD:L_1210_3225Metric'],['1812','Inductor_SMD:L_1812_4532Metric']];
  each(inductorValues,v=>each(lPkgs,([pkg,fp])=>add({prefix:'L',code:'L',name:`Inductor ${pkg}`,value:v,group:'Passives',footprint:fp,pinCount:2,tags:['inductor','smd',pkg],description:'Generic inductor template; verify saturation current, DCR, SRF and exact package.'})));

  const beadValues=['30 Ω @100MHz','60 Ω @100MHz','90 Ω @100MHz','120 Ω @100MHz','220 Ω @100MHz','330 Ω @100MHz','600 Ω @100MHz','1 kΩ @100MHz'];
  each(beadValues,v=>each(lPkgs.slice(0,5),([pkg,fp])=>add({prefix:'FB',code:'FB',name:`Ferrite Bead ${pkg}`,value:v,group:'EMI / Filtering',footprint:fp,pinCount:2,tags:['ferrite','emi','filter',pkg],description:'Generic ferrite bead template; impedance curve and current rating require an exact part.'})));

  // Frequency/control components.
  const xtalFreq=['32.768 kHz','1 MHz','2 MHz','4 MHz','8 MHz','10 MHz','12 MHz','16 MHz','20 MHz','24 MHz','25 MHz','26 MHz','27 MHz','32 MHz','40 MHz','48 MHz','50 MHz','80 MHz'];
  const xtalPkgs=[['2016','Crystal:Crystal_SMD_2016-4Pin_2.0x1.6mm'],['2520','Crystal:Crystal_SMD_2520-4Pin_2.5x2.0mm'],['3225','Crystal:Crystal_SMD_3225-4Pin_3.2x2.5mm']];
  each(xtalFreq,v=>each(xtalPkgs,([pkg,fp])=>add({prefix:'Y',code:'XTAL',name:`Crystal ${pkg}`,value:v,group:'Timing / Clock',footprint:fp,pinCount:4,tags:['crystal','clock',pkg],description:'Generic crystal template; load capacitance, ESR and drive level require exact MPN.'})));

  const oscFreq=['1 MHz','4 MHz','8 MHz','10 MHz','12 MHz','16 MHz','20 MHz','24 MHz','25 MHz','26 MHz','27 MHz','32 MHz','40 MHz','48 MHz','50 MHz','100 MHz','125 MHz'];
  each(oscFreq,v=>add({prefix:'Y',code:'OSC',name:'CMOS Oscillator',value:v,group:'Timing / Clock',footprint:'—',pinCount:4,tags:['oscillator','clock'],description:'Generic active oscillator. Assign the exact footprint after choosing a part.'}));

  // LEDs and optoelectronics.
  const ledColors=['Red','Green','Blue','Yellow','Amber','Orange','White','Warm White','UV','IR'];
  const ledPkgs=[['0201','LED_SMD:LED_0201_0603Metric'],['0402','LED_SMD:LED_0402_1005Metric'],['0603','LED_SMD:LED_0603_1608Metric'],['0805','LED_SMD:LED_0805_2012Metric'],['1206','LED_SMD:LED_1206_3216Metric'],['5mm THT','LED_THT:LED_D5.0mm']];
  each(ledColors,color=>each(ledPkgs,([pkg,fp])=>add({prefix:'D',code:'LED',name:`${color} LED ${pkg}`,value:color,group:'Optoelectronics',footprint:fp,pinCount:2,tags:['led',color.toLowerCase(),pkg],description:'Generic LED; forward voltage/current and optical output require an exact part.'})));

  // Connectors — broad integration coverage.
  for(let n=1;n<=40;n++){
    const p=String(n).padStart(2,'0');
    add({prefix:'J',code:'J',name:`Pin Header 1x${p}`,value:'2.54 mm',group:'Connectors',footprint:`Connector_PinHeader_2.54mm:PinHeader_1x${p}_P2.54mm_Vertical`,pinCount:n,tags:['header','2.54mm','single-row']});
    add({prefix:'J',code:'J',name:`Pin Socket 1x${p}`,value:'2.54 mm',group:'Connectors',footprint:`Connector_PinSocket_2.54mm:PinSocket_1x${p}_P2.54mm_Vertical`,pinCount:n,tags:['socket','2.54mm','single-row']});
  }
  for(let n=2;n<=40;n+=2){
    const rows=n/2,p=String(rows).padStart(2,'0');
    add({prefix:'J',code:'J',name:`Pin Header 2x${p}`,value:'2.54 mm',group:'Connectors',footprint:`Connector_PinHeader_2.54mm:PinHeader_2x${p}_P2.54mm_Vertical`,pinCount:n,tags:['header','2.54mm','dual-row']});
    add({prefix:'J',code:'J',name:`IDC Header 2x${p}`,value:'2.54 mm',group:'Connectors',footprint:'—',pinCount:n,tags:['idc','ribbon','dual-row'],description:'Generic IDC connector; assign exact shrouded/unshrouded footprint.'});
  }
  for(let n=2;n<=12;n++) add({prefix:'J',code:'TB',name:`Screw Terminal ${n}P`,value:'5.08 mm',group:'Connectors',footprint:'—',pinCount:n,tags:['terminal','screw','5.08mm'],description:'Generic screw terminal; footprint depends on exact terminal block family.'});

  // Switch/input templates.
  ['SPST','SPDT','DPST','DPDT'].forEach(type=>{
    add({prefix:'SW',code:'SW',name:`${type} Toggle Switch`,value:type,group:'Switches / Input',footprint:'—',pinCount:type==='SPST'?2:type==='SPDT'?3:type==='DPST'?4:6,tags:['switch','toggle']});
    add({prefix:'SW',code:'SW',name:`${type} Slide Switch`,value:type,group:'Switches / Input',footprint:'—',pinCount:type==='SPST'?2:type==='SPDT'?3:type==='DPST'?4:6,tags:['switch','slide']});
  });
  for(let n=1;n<=12;n++) add({prefix:'SW',code:'BTN',name:`Push Button ${n}`,value:'Momentary',group:'Switches / Input',footprint:'—',pinCount:2,tags:['button','momentary']});
  for(let n=1;n<=16;n++) add({prefix:'SW',code:'DIP',name:`DIP Switch ${n}-position`,value:`${n} position`,group:'Switches / Input',footprint:'—',pinCount:n*2,tags:['dip-switch']});
  for(let n=1;n<=16;n++) add({prefix:'TP',code:'TP',name:`Test Point ${n} mm`,value:'Probe point',group:'Debug / Test',footprint:'—',pinCount:1,tags:['testpoint','debug']});

  // Generic semiconductors and protection.
  const commonDiodes=[
    ['1N4148','Signal diode'],['1N4001','Rectifier diode'],['1N4007','Rectifier diode'],['SS14','Schottky diode'],['SS34','Schottky diode'],['BAT54','Schottky diode'],
    ['BAV99','Dual switching diode'],['1N5817','Schottky rectifier'],['1N5819','Schottky rectifier'],['SMBJ5.0A','TVS diode'],['SMBJ12A','TVS diode'],['SMBJ24A','TVS diode']
  ];
  each(commonDiodes,([mpn,name])=>add({prefix:'D',code:'D',name,value:mpn,mpn,group:'Diodes / Protection',footprint:'—',pinCount:/Dual/.test(name)?3:2,kind:'exact-id',tags:['diode','protection'],description:'Exact part identifier is listed; choose package/variant and verify ratings from the current datasheet.'}));

  const transistors=[
    ['2N3904','NPN BJT',3],['2N3906','PNP BJT',3],['BC547','NPN BJT',3],['BC557','PNP BJT',3],['S8050','NPN BJT',3],['S8550','PNP BJT',3],
    ['2N7000','N-MOSFET',3],['2N7002','N-MOSFET',3],['BSS138','N-MOSFET',3],['AO3400A','N-MOSFET',3],['AO3401A','P-MOSFET',3],['IRLZ44N','N-MOSFET',3],['IRF540N','N-MOSFET',3],
    ['J201','N-JFET',3],['J113','N-JFET',3]
  ];
  each(transistors,([mpn,name,pins])=>add({prefix:'Q',code:'Q',name,value:mpn,mpn,group:'Transistors',footprint:'—',pinCount:pins,kind:'exact-id',tags:['transistor',name.toLowerCase()],description:'Exact device name; footprint/pinout and electrical ratings must be verified for the selected manufacturer/package.'}));

  // Common logic families.
  const logicParts=['74HC00','74HC02','74HC04','74HC08','74HC14','74HC20','74HC21','74HC27','74HC30','74HC32','74HC42','74HC47','74HC48','74HC74','74HC85','74HC86','74HC109','74HC123','74HC125','74HC126','74HC132','74HC138','74HC139','74HC147','74HC148','74HC151','74HC153','74HC154','74HC157','74HC161','74HC163','74HC164','74HC165','74HC166','74HC173','74HC174','74HC175','74HC181','74HC191','74HC192','74HC193','74HC194','74HC221','74HC238','74HC240','74HC241','74HC244','74HC245','74HC251','74HC253','74HC257','74HC258','74HC259','74HC273','74HC280','74HC283','74HC299','74HC365','74HC366','74HC367','74HC368','74HC373','74HC374','74HC377','74HC390','74HC393','74HC4017','74HC4040','74HC4051','74HC4052','74HC4053','74HC4060','74HC4094','74HC595'];
  each(logicParts,mpn=>add({prefix:'U',code:'LOGIC',name:`${mpn} Logic IC`,value:mpn,mpn,group:'Logic',footprint:'—',pinCount:0,kind:'exact-id',tags:['logic','74hc'],description:'Logic family entry. Package and pin count depend on the exact suffix/package; assign from datasheet.'}));

  // Analog/op-amp/comparator references.
  const analog=[
    ['LM358','Dual op-amp',8],['LM324','Quad op-amp',14],['TL071','Op-amp',8],['TL072','Dual JFET op-amp',8],['TL074','Quad JFET op-amp',14],['NE5532','Dual low-noise op-amp',8],
    ['OPA2134','Dual audio op-amp',8],['OPA134','Audio op-amp',8],['MCP6001','Rail-to-rail op-amp',5],['MCP6002','Dual rail-to-rail op-amp',8],['MCP6004','Quad rail-to-rail op-amp',14],
    ['LM393','Dual comparator',8],['LM339','Quad comparator',14],['LM311','Comparator',8],['TL431','Adjustable shunt reference',3],['LM4040','Voltage reference',2]
  ];
  each(analog,([mpn,name,pins])=>add({prefix:'U',code:'U',name,value:mpn,mpn,group:'Analog',footprint:'—',pinCount:pins,kind:'exact-id',tags:['analog',name.toLowerCase()],description:'Common exact-part family entry; verify manufacturer suffix, supply limits, pinout and package.'}));

  // Audio: amplifiers, codecs, DAC/ADC, microphones and common modules.
  const audio=[
    ['LM386','Low-voltage audio power amplifier',8],['NE5532','Low-noise dual audio op-amp',8],['TL072','Dual JFET audio op-amp',8],['OPA2134','Dual audio op-amp',8],
    ['PAM8403','Class-D stereo amplifier',16],['MAX98357A','I2S Class-D mono amplifier',16],['TPA2016D2','Stereo Class-D amplifier',20],['TPA3116D2','Stereo Class-D amplifier',32],
    ['TPA3255','Class-D power amplifier',44],['TAS5805M','Digital-input Class-D amplifier',48],['PCM5102A','Stereo audio DAC',20],['PCM5122','Stereo audio DAC',28],
    ['PCM1808','Stereo audio ADC',14],['PCM1862','Audio ADC',32],['WM8960','Stereo audio codec',32],['SGTL5000','Low-power stereo codec',32],['CS4344','Stereo DAC',10],
    ['ES9023','Stereo audio DAC',16],['AK4556','Stereo codec',20],['MAX9814','Microphone amplifier with AGC',14],['MAX4466','Microphone preamplifier',8],['INMP441','I2S MEMS microphone',6],
    ['SPH0645LM4H','I2S MEMS microphone',6],['ICS-43434','I2S MEMS microphone',6],['PGA2311','Stereo volume control',16],['PT2314','Audio processor',28],
    ['TDA2030A','Audio power amplifier',5],['TDA7294','Audio power amplifier',15],['TDA2822M','Dual low-voltage audio amplifier',8],['LM1875','Audio power amplifier',5]
  ];
  each(audio,([mpn,name,pins])=>add({prefix:/microphone/i.test(name)?'MK':'U',code:/microphone/i.test(name)?'MIC':'AUDIO',name,value:mpn,mpn,group:'Audio',footprint:'—',pinCount:pins,kind:'exact-id',tags:['audio',name.toLowerCase()],description:'Audio component entry. Package, thermal design, analog layout and exact electrical limits require datasheet verification.'}));
  ['Electret Microphone','Dynamic Microphone','Speaker 4 Ω','Speaker 8 Ω','Piezo Buzzer','Magnetic Buzzer','3.5 mm Stereo Jack','RCA Audio Jack','XLR-3 Audio Connector'].forEach((name,i)=>add({prefix:i<2?'MK':i<6?'LS':'J',code:i<2?'MIC':i<6?'AUDIO':'J',name,value:'Generic',group:'Audio',footprint:'—',pinCount:/Stereo/.test(name)?5:/XLR/.test(name)?3:2,tags:['audio','transducer'],description:'Generic audio/mechanical template; choose an exact physical part before layout.'}));

  // Power management.
  const power=[
    ['7805','5 V linear regulator',3],['7812','12 V linear regulator',3],['LM317','Adjustable linear regulator',3],['AMS1117-3.3','3.3 V LDO',3],['AMS1117-5.0','5 V LDO',3],
    ['AP2112K-3.3','3.3 V LDO',5],['MCP1700-3302','3.3 V LDO',3],['TLV1117-33','3.3 V LDO',3],['LM2596','Buck regulator',5],['MP1584EN','Buck regulator',8],
    ['MP2307DN','Buck regulator',8],['TPS62160','Buck regulator',8],['TPS5430','Buck regulator',8],['MT3608','Boost regulator',6],['XL6009','Boost regulator',5],
    ['TPS61023','Boost converter',6],['TPS63020','Buck-boost converter',14],['TP4056','Li-ion charger',8],['MCP73831','Li-ion charger',5],['BQ24074','Li-ion charger/power path',16],
    ['DW01A','Li-ion protection controller',6],['FS8205A','Dual MOSFET protection',8],['INA219','Current/power monitor',8],['INA226','Current/power monitor',10],['ACS712','Hall current sensor',8]
  ];
  each(power,([mpn,name,pins])=>add({prefix:'U',code:'PWR',name,value:mpn,mpn,group:'Power Management',footprint:'—',pinCount:pins,kind:'exact-id',tags:['power',name.toLowerCase()],description:'Power-management entry. Exact package, thermal limits, compensation/passives and current capability require datasheet design.'}));

  // Interfaces, converters and memories.
  const interfaces=[
    ['CH340C','USB-UART bridge',16],['CH340G','USB-UART bridge',16],['CP2102N','USB-UART bridge',24],['FT232RL','USB-UART bridge',28],['MCP2221A','USB-UART/I2C bridge',14],
    ['MAX232','RS-232 transceiver',16],['MAX485','RS-485 transceiver',8],['SN65HVD230','CAN transceiver',8],['MCP2515','CAN controller',18],['TJA1051','CAN transceiver',8],
    ['PCA9306','I2C level translator',8],['TXS0108E','8-bit level translator',20],['TXB0104','4-bit level translator',14],['74LVC1T45','Single-bit level translator',6],
    ['MCP3008','10-bit ADC',16],['ADS1115','16-bit ADC',10],['MCP4725','12-bit DAC',6],['DAC8568','8-channel DAC',24]
  ];
  each(interfaces,([mpn,name,pins])=>add({prefix:'U',code:'IF',name,value:mpn,mpn,group:'Interface / Data',footprint:'—',pinCount:pins,kind:'exact-id',tags:['interface',name.toLowerCase()]}));

  const memories=[
    ['24LC256','I2C EEPROM',8],['AT24C32','I2C EEPROM',8],['25LC256','SPI EEPROM',8],['W25Q16JV','SPI NOR flash',8],['W25Q32JV','SPI NOR flash',8],['W25Q64JV','SPI NOR flash',8],
    ['W25Q128JV','SPI NOR flash',8],['FM24CL64B','I2C FRAM',8],['MB85RC256V','I2C FRAM',8],['23LC1024','SPI SRAM',8]
  ];
  each(memories,([mpn,name,pins])=>add({prefix:'U',code:'MEM',name,value:mpn,mpn,group:'Memory',footprint:'—',pinCount:pins,kind:'exact-id',tags:['memory',name.toLowerCase()]}));

  // MCU / wireless families.
  const mcu=[
    ['ATmega328P','8-bit AVR MCU',28],['ATmega32U4','USB AVR MCU',44],['ATtiny85','8-bit AVR MCU',8],['PIC16F877A','8-bit PIC MCU',40],['PIC18F4550','USB PIC MCU',40],
    ['RP2040','Dual-core Cortex-M0+ MCU',56],['RP2350','Dual-core microcontroller',0],['STM32F103C8T6','Cortex-M3 MCU',48],['STM32F401CCU6','Cortex-M4 MCU',48],['STM32F411CEU6','Cortex-M4 MCU',48],
    ['STM32G0B1CBT6','Cortex-M0+ MCU',48],['STM32H743VIT6','Cortex-M7 MCU',100],['nRF52832','Bluetooth SoC',48],['nRF52840','Bluetooth SoC',73],
    ['ESP32-WROOM-32','Wi-Fi/Bluetooth module',38],['ESP32-WROVER','Wi-Fi/Bluetooth module',38],['ESP32-S3-WROOM-1','Wi-Fi/Bluetooth module',41],['ESP32-C3-MINI-1','Wi-Fi/Bluetooth module',53],
    ['ESP8266EX','Wi-Fi SoC',32],['ESP-12F','ESP8266 Wi-Fi module',22]
  ];
  each(mcu,([mpn,name,pins])=>add({prefix:'U',code:/module/i.test(name)?'MOD':'MCU',name,value:mpn,mpn,group:/Wi-Fi|Bluetooth/.test(name)?'Wireless / RF':'MCU / Processor',footprint:'—',pinCount:pins,kind:'exact-id',tags:['mcu','embedded',name.toLowerCase()],description:'MCU/module entry. Pinout, flash options, RF keepout, decoupling and package must be checked against the exact datasheet/module guide.'}));

  // Sensors.
  const sensors=[
    ['BME280','Temperature/humidity/pressure sensor',8],['BMP280','Pressure/temperature sensor',8],['BMP388','Pressure sensor',10],['SHT31','Temperature/humidity sensor',8],['SHT40','Temperature/humidity sensor',4],
    ['DHT11','Temperature/humidity sensor',4],['DHT22','Temperature/humidity sensor',4],['DS18B20','Digital temperature sensor',3],['TMP102','Digital temperature sensor',6],['TMP117','Precision temperature sensor',6],
    ['MPU6050','6-axis IMU',24],['MPU9250','9-axis IMU',24],['ICM-20948','9-axis IMU',24],['BMI160','6-axis IMU',14],['BNO055','Absolute orientation sensor',28],
    ['LIS3DH','3-axis accelerometer',16],['ADXL345','3-axis accelerometer',14],['HMC5883L','Magnetometer',16],['QMC5883L','Magnetometer',16],['VL53L0X','Time-of-flight distance sensor',12],
    ['VL53L1X','Time-of-flight distance sensor',12],['APDS-9960','Gesture/proximity/RGB sensor',8],['BH1750','Ambient light sensor',6],['TSL2591','Light sensor',6],['MAX30102','Pulse-ox/heart-rate sensor',14],
    ['MLX90614','IR temperature sensor',4],['INA219','Current/power sensor',8],['HX711','Load-cell ADC',16],['ADS1232','24-bit bridge ADC',24],['MCP9808','Temperature sensor',8]
  ];
  each(sensors,([mpn,name,pins])=>add({prefix:'U',code:'SENS',name,value:mpn,mpn,group:'Sensors',footprint:'—',pinCount:pins,kind:'exact-id',tags:['sensor',name.toLowerCase()]}));

  // Displays and drivers.
  const displays=[
    ['SSD1306','OLED display controller',28],['SH1106','OLED display controller',30],['ST7735','TFT display controller',0],['ST7789','TFT display controller',0],['ILI9341','TFT display controller',0],
    ['TM1637','LED display driver',20],['MAX7219','LED matrix/display driver',24],['HT16K33','LED driver/keyscan',28],['PCF8574','I/O expander commonly used with LCD',16]
  ];
  each(displays,([mpn,name,pins])=>add({prefix:'U',code:'DISP',name,value:mpn,mpn,group:'Display / HMI',footprint:'—',pinCount:pins,kind:'exact-id',tags:['display',name.toLowerCase()]}));
  ['16x2 Character LCD Module','20x4 Character LCD Module','0.96 inch OLED I2C Module','1.3 inch OLED I2C Module','2.4 inch TFT SPI Module','2.8 inch TFT SPI Module','E-Paper Display Module'].forEach(name=>add({prefix:'DS',code:'DISP',name,value:'Module',group:'Display / HMI',footprint:'—',pinCount:0,tags:['display','module'],description:'Integration module template; connector/pinout varies by vendor module.'}));

  // Motors and actuator drivers.
  const drivers=[
    ['L293D','Dual H-bridge driver',16],['L298N','Dual H-bridge driver',15],['DRV8833','Dual H-bridge driver',16],['TB6612FNG','Dual motor driver',24],['A4988','Stepper driver',28],
    ['DRV8825','Stepper driver',28],['TMC2208','Stepper driver',28],['TMC2209','Stepper driver',28],['ULN2003A','Darlington driver array',16],['PCA9685','16-channel PWM driver',28]
  ];
  each(drivers,([mpn,name,pins])=>add({prefix:'U',code:'DRV',name,value:mpn,mpn,group:'Motor / Driver',footprint:'—',pinCount:pins,kind:'exact-id',tags:['motor','driver']}));
  ['DC Motor','Brushless DC Motor','Stepper Motor Bipolar','Stepper Motor Unipolar','Servo Motor 3-wire','Solenoid','Relay SPDT','Relay DPDT'].forEach((name,i)=>add({prefix:/Relay/.test(name)?'K':'M',code:/Relay/.test(name)?'RELAY':'MOTOR',name,value:'Generic',group:'Motor / Driver',footprint:'—',pinCount:/Servo/.test(name)?3:/Bipolar/.test(name)?4:/Unipolar/.test(name)?5:/DPDT/.test(name)?8:/SPDT/.test(name)?5:2,tags:['actuator'],description:'Generic electromechanical template; exact footprint, current, coil and driver requirements must be verified.'}));

  // Raspberry Pi and maker/compute modules.
  const boards=[
    ['Raspberry Pi Pico','RP2040 development board',40,'Raspberry Pi'],['Raspberry Pi Pico W','RP2040 Wi-Fi development board',40,'Raspberry Pi'],['Raspberry Pi Pico 2','RP2350 development board',40,'Raspberry Pi'],['Raspberry Pi Pico 2 W','RP2350 wireless development board',40,'Raspberry Pi'],
    ['Raspberry Pi 40-pin GPIO Header','GPIO integration connector',40,'Raspberry Pi'],['Raspberry Pi Zero / Zero W GPIO Header','40-pin GPIO connector',40,'Raspberry Pi'],['Raspberry Pi Zero 2 W GPIO Header','40-pin GPIO connector',40,'Raspberry Pi'],
    ['Raspberry Pi 3 Model B/B+ GPIO Header','40-pin GPIO connector',40,'Raspberry Pi'],['Raspberry Pi 4 Model B GPIO Header','40-pin GPIO connector',40,'Raspberry Pi'],['Raspberry Pi 5 GPIO Header','40-pin GPIO connector',40,'Raspberry Pi'],
    ['Raspberry Pi Compute Module 4 Carrier Interface','CM4 dual mezzanine connector interface',200,'Raspberry Pi'],['Raspberry Pi Compute Module 5 Carrier Interface','CM5 carrier connector interface',0,'Raspberry Pi'],
    ['Arduino Uno R3 Shield Headers','Arduino shield integration headers',0,'Modules / Boards'],['Arduino Nano','ATmega328P module',30,'Modules / Boards'],['Arduino Nano Every','ATmega4809 module',30,'Modules / Boards'],['Arduino Mega 2560 Shield Headers','Arduino Mega integration headers',0,'Modules / Boards'],
    ['ESP32 DevKitC','ESP32 development module',38,'Modules / Boards'],['ESP32-S3 DevKitC-1','ESP32-S3 development module',44,'Modules / Boards'],['ESP8266 NodeMCU','ESP8266 development module',30,'Modules / Boards'],['Wemos D1 Mini','ESP8266 development module',16,'Modules / Boards'],
    ['STM32 Blue Pill','STM32F103 development module',40,'Modules / Boards'],['STM32 Black Pill','STM32F4 development module',40,'Modules / Boards'],['Teensy 4.0','Cortex-M7 development board',40,'Modules / Boards'],['Teensy 4.1','Cortex-M7 development board',48,'Modules / Boards'],
    ['Seeed XIAO RP2040','RP2040 module',14,'Modules / Boards'],['Seeed XIAO ESP32C3','ESP32-C3 module',14,'Modules / Boards'],['Adafruit Feather RP2040','RP2040 Feather board',28,'Modules / Boards'],['Adafruit Feather ESP32-S3','ESP32-S3 Feather board',28,'Modules / Boards'],
    ['micro:bit v2 Edge Connector','micro:bit integration connector',80,'Modules / Boards']
  ];
  each(boards,([name,value,pins,group])=>add({prefix:'MOD',code:'MOD',name,value,group,footprint:'—',pinCount:pins,kind:'module',tags:['module','board',group.toLowerCase()],description:'Board/module integration template. Verify connector mechanics, exact pinout and keepout before PCB layout.'}));

  // Common communication modules/connectors.
  const modules=[
    ['HC-05 Bluetooth Module',6],['HC-06 Bluetooth Module',4],['nRF24L01+ Module',8],['RFM69 Module',16],['RFM95 LoRa Module',16],['SX1278 LoRa Module',16],['SIM800L GSM Module',7],['SIM7600 LTE Module',0],
    ['NEO-6M GPS Module',4],['NEO-M8N GPS Module',4],['ESP-01 ESP8266 Module',8],['ESP32-CAM Module',16],['RC522 RFID Module',8],['PN532 NFC Module',8],['W5500 Ethernet Module',10],['ENC28J60 Ethernet Module',10]
  ];
  each(modules,([name,pins])=>add({prefix:'MOD',code:'MOD',name,value:'Module',group:'Modules / Boards',footprint:'—',pinCount:pins,kind:'module',tags:['module','communication'],description:'Module-level integration entry; verify exact module revision, supply level and connector/pad geometry.'}));

  // Sources and battery-related templates.
  ['1.2 V','1.5 V','3.0 V','3.3 V','3.7 V','5 V','9 V','12 V','15 V','24 V','48 V'].forEach(v=>add({prefix:'V',code:'V',name:'DC Voltage Source',value:v,group:'Sources',footprint:'—',pinCount:2,tags:['source','dc']}));
  ['AA 1-cell','AA 2-cell','AA 3-cell','AAA 1-cell','AAA 2-cell','18650 1-cell','18650 2-cell','LiPo 1S','LiPo 2S','CR2032'].forEach(name=>add({prefix:'BT',code:'BAT',name:`Battery ${name}`,value:name,group:'Power / Battery',footprint:'—',pinCount:2,tags:['battery'],description:'Battery template; holder/connector, chemistry, protection and current capability require exact selection.'}));

  // Common USB and board connectors.
  const boardConnectors=[
    ['USB 2.0 Type-C Receptacle','USB-C',24],['USB Micro-B Receptacle','Micro USB',5],['USB Mini-B Receptacle','Mini USB',5],['USB Type-A Receptacle','USB-A',4],
    ['RJ45 8P8C','Ethernet',8],['RJ11 6P','Telephone/modular',6],['HDMI Type-A Receptacle','HDMI',19],['DisplayPort Receptacle','DisplayPort',20],
    ['JST-PH 2-pin','Battery connector',2],['JST-PH 3-pin','Connector',3],['JST-XH 2-pin','Connector',2],['JST-XH 3-pin','Connector',3],['JST-XH 4-pin','Connector',4],
    ['Barrel Jack 2.1 mm','DC power jack',3],['M.2 Key E Socket','Module socket',75],['microSD Socket','Memory card socket',8],['SD Card Socket','Memory card socket',9]
  ];
  each(boardConnectors,([name,value,pins])=>add({prefix:'J',code:'J',name,value,group:'Connectors',footprint:'—',pinCount:pins,tags:['connector',value.toLowerCase()],description:'Connector symbol/integration template; exact mechanical footprint must match the chosen manufacturer part.'}));

  window.PCBProComponentCatalog={
    version:VERSION,
    build:()=>items.map(x=>({...x,tags:[...x.tags]})),
    summary:()=>({
      version:VERSION,
      total:items.length,
      groups:[...new Set(items.map(x=>x.group))].sort(),
      templates:items.filter(x=>x.kind==='template').length,
      exactIds:items.filter(x=>x.kind==='exact-id').length,
      modules:items.filter(x=>x.kind==='module').length
    })
  };
})();