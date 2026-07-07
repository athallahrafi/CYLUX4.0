#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==================== KONFIGURASI OLED ====================
#define SCREEN_WIDTH 128 
#define SCREEN_HEIGHT 64 
#define OLED_RESET    -1 
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==================== DEFINISI PIN ====================
// Pin Pompa Peristaltik
const int peris_IN1 = 8;
const int peris_IN2 = 7;
const int peris_STBY = 10;
const int peris_PWM = 5;

// Pin Motor Penggerak (Cylux)
const int motor_IN1 = 4;
const int motor_IN2 = 3;
const int motor_STBY = 9;
const int motor_PWM = 6;

// Pin LED Indikator & Input
const int ledMerah = 12;
const int ledHijau = 11;
const int pinTrigger = 2;       
const int pinTurbidity = A0;    

// ==================== KONFIGURASI KENDALI ====================
const int BATAS_TURBIDITY = 120;   // Target reaksi kimia (Berhenti jika < 37)
const int speedPeristaltic = 255; 
const int speedMotor = 255;       

// Status & Pewaktuan Sistem
bool isRunning = false;
bool targetTercapai = false; 

unsigned long startTime = 0;
unsigned long elapsedMillis = 0; // Menyimpan waktu tempuh/reaksi
unsigned long previousMillisOLED = 0;
const long intervalOLED = 200; 

void setup() {
  Serial.begin(115200);

  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println(F("OLED tidak terdeteksi!"));
    for(;;); 
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  pinMode(peris_IN1, OUTPUT); pinMode(peris_IN2, OUTPUT);
  pinMode(peris_STBY, OUTPUT); pinMode(peris_PWM, OUTPUT);
  pinMode(motor_IN1, OUTPUT); pinMode(motor_IN2, OUTPUT);
  pinMode(motor_STBY, OUTPUT); pinMode(motor_PWM, OUTPUT);
  pinMode(ledMerah, OUTPUT); pinMode(ledHijau, OUTPUT);
  pinMode(pinTrigger, INPUT_PULLUP); 
  pinMode(pinTurbidity, INPUT);

  // Standby awal (Tanpa rem aktif, cukup dimatikan/coast)
  matikanSemuaAktuatorStandby();
  digitalWrite(ledMerah, HIGH);
  digitalWrite(ledHijau, LOW);
}

void loop() {
  int nilaiTurbidity = analogRead(pinTurbidity);
  unsigned long currentMillis = millis();

  // Menghitung waktu berjalan secara real-time
  if (isRunning) {
    elapsedMillis = currentMillis - startTime;
  }

  // Update Layar OLED tiap 200ms
  if (currentMillis - previousMillisOLED >= intervalOLED) {
    previousMillisOLED = currentMillis;
    updateLayarOLED(nilaiTurbidity);
  }

  bool triggerDitekan = (digitalRead(pinTrigger) == LOW);

  // LOGIKA START
  if (triggerDitekan && !isRunning) {
    delay(200); // Debouncing
    targetTercapai = false;
    startTime = millis(); // Mulai menghitung waktu
    elapsedMillis = 0;
    jalankanSistem();
  }

  // LOGIKA AUTO-STOP (Turbidity < 37)
  if (isRunning) {
    if (nilaiTurbidity <= BATAS_TURBIDITY) {
      targetTercapai = true;
      hentikanSistemDenganRem();
    }
  }
}

// ==================== FUNGSI UI & KENDALI ====================

void updateLayarOLED(int nilaiSensor) {
  display.clearDisplay();
  
  // Header
  display.setTextSize(1);
  display.setCursor(6, 0);
  display.print("CYLUX4.0 CHEM-E-CAR"); 

  // Status Sistem
  display.setCursor(0, 16);
  if (isRunning) {
    display.print("Status: RUNNING >>>");
  } else if (targetTercapai) {
    display.print("Status: BRAKED (END)");
  } else {
    display.print("Status: STANDBY");
  }

  // Menghitung Menit dan Detik dari elapsedMillis
  int menit = (elapsedMillis / 1000) / 60;
  int detik = (elapsedMillis / 1000) % 60;

  // Menampilkan Waktu (Format MM:SS)
  display.setCursor(0, 32);
  display.print("Waktu : ");
  if (menit < 10) display.print("0");
  display.print(menit);
  display.print(":");
  if (detik < 10) display.print("0");
  display.print(detik);

  // Menampilkan ADC Aktual vs Target
  display.setCursor(0, 48);
  display.print("ADC   : ");
  display.print(nilaiSensor);
  display.print(" (T:<120)");

  display.display();
}

void jalankanSistem() {
  isRunning = true;
  digitalWrite(ledMerah, LOW);
  digitalWrite(ledHijau, HIGH);

  // Peristaltik ON
  digitalWrite(peris_STBY, HIGH);
  digitalWrite(peris_IN1, HIGH);
  digitalWrite(peris_IN2, LOW);
  analogWrite(peris_PWM, speedPeristaltic);

  // Motor Penggerak ON
  digitalWrite(motor_STBY, HIGH);
  digitalWrite(motor_IN1, HIGH);
  digitalWrite(motor_IN2, LOW);
  analogWrite(motor_PWM, speedMotor);
}

void hentikanSistemDenganRem() {
  isRunning = false;
  
  // 1. Pompa Peristaltik dimatikan biasa (Coast/Low Power)
  digitalWrite(peris_STBY, LOW);
  digitalWrite(peris_IN1, LOW);
  digitalWrite(peris_IN2, LOW);
  analogWrite(peris_PWM, 0);

  // 2. Motor Penggerak di-REM AKTIF (Short Brake)
  digitalWrite(motor_STBY, HIGH);  // STBY wajib HIGH agar rem berfungsi
  digitalWrite(motor_IN1, HIGH);   // IN1 HIGH
  digitalWrite(motor_IN2, HIGH);   // IN2 HIGH
  analogWrite(motor_PWM, 0);       // Putus sinyal PWM

  digitalWrite(ledHijau, LOW);
  digitalWrite(ledMerah, HIGH);
  
  delay(1000); // Jeda pengaman
}

void matikanSemuaAktuatorStandby() {
  // Fungsi ini mematikan semua total (STBY LOW) saat pertama nyala
  digitalWrite(peris_STBY, LOW);
  digitalWrite(peris_IN1, LOW);
  digitalWrite(peris_IN2, LOW);
  analogWrite(peris_PWM, 0);

  digitalWrite(motor_STBY, LOW);
  digitalWrite(motor_IN1, LOW);
  digitalWrite(motor_IN2, LOW);
  analogWrite(motor_PWM, 0);
}