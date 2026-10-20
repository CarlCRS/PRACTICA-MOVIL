// PIEZA 7: PODSPEC — sin esto, CocoaPods no puede instalar el plugin iOS.
// (En tu matriz: "Swift con xframeworks y CocoaPods" — este archivo es
//  el que conecte tu plugin con el Podfile de la app.)
Pod::Spec.new do |s|
  s.name = 'PlanSeguroPlugin'
  s.version = '0.0.1'
  s.summary = 'Plugin demo: plan médico seguro + patrón callbacks'
  s.license = 'MIT'
  s.homepage = 'https://example.invalid/plugin'
  s.author = 'Equipo pratique'
  s.source = { :git => 'https://example.invalid/plugin.git', :tag => 'v0.0.1' }
  s.source_files = 'ios/Plugin/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target  = '14.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
